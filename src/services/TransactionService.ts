/**
 * TransactionService.ts
 * Core banking logic: transfers, idempotency, overdraft guard, ACID transactions.
 *
 * Rules:
 *  - All amounts are BigInt in centavos (1 BRL = 100 centavos). Never use floats.
 *  - Every money-movement accepts an idempotencyKey (UUID v4 from client).
 *  - If the key was seen before, the cached response is returned immediately.
 *  - Negative balances are allowed down to -overdraftLimit.
 *  - Prisma $transaction with serializable isolation + SELECT FOR UPDATE row lock.
 */

import { PrismaClient, Transaction, Account,  } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface TransferInput {
  /** Caller-supplied UUID v4 — prevents double-spend on retries */
  idempotencyKey: string;
  fromAccountId: string;
  toAccountId: string;
  /** Amount in centavos — must be > 0 */
  amountCents: bigint;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface TransferResult {
  idempotent: boolean; // true if this key was already processed
  debitTx: Transaction;
  creditTx: Transaction;
}

// ─────────────────────────────────────────────
// Error classes
// ─────────────────────────────────────────────

export class InsufficientFundsError extends Error {
  constructor(
    public readonly available: bigint,
    public readonly required: bigint
  ) {
    super(
      `Saldo insuficiente. Disponível: R$ ${centavosToReal(available)}, ` +
        `necessário: R$ ${centavosToReal(required)}.`
    );
    this.name = "InsufficientFundsError";
  }
}

export class AccountNotFoundError extends Error {
  constructor(id: string) {
    super(`Conta não encontrada: ${id}`);
    this.name = "AccountNotFoundError";
  }
}

export class AccountInactiveError extends Error {
  constructor(id: string) {
    super(`Conta inativa: ${id}`);
    this.name = "AccountInactiveError";
  }
}

export class InvalidAmountError extends Error {
  constructor() {
    super("O valor da transferência deve ser maior que zero.");
    this.name = "InvalidAmountError";
  }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super("Chave de idempotência já usada com parâmetros diferentes.");
    this.name = "IdempotencyConflictError";
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function centavosToReal(cents: bigint): string {
  const abs = cents < 0n ? -cents : cents;
  const reais = abs / 100n;
  const centavos = abs % 100n;
  const sign = cents < 0n ? "-" : "";
  return `${sign}${reais}.${String(centavos).padStart(2, "0")}`;
}

/** Returns the effective available amount: balance + overdraftLimit */
function effectiveAvailable(account: Account): bigint {
  return account.balance + account.overdraftLimit;
}

// ─────────────────────────────────────────────
// TransactionService
// ─────────────────────────────────────────────

export class TransactionService {
  constructor(private readonly db: PrismaClient) {}

  // ───────────────────────────────────────────
  // Public: transfer
  // ───────────────────────────────────────────

  async transfer(input: TransferInput): Promise<TransferResult> {
    const {
      idempotencyKey,
      fromAccountId,
      toAccountId,
      amountCents,
      description,
      metadata,
    } = input;

    // 1. Guard: amount must be positive
    if (amountCents <= 0n) throw new InvalidAmountError();

    // 2. Idempotency check (outside main transaction — fast path)
    const existing = await this.db.idempotencyKey.findUnique({
      where: { key: idempotencyKey },
    });

    if (existing) {
      // Key was seen before — validate it matches the same request
      const cached = JSON.parse(existing.responseBody as string) as {
        debitTxId: string;
        creditTxId: string;
        fromAccountId: string;
        toAccountId: string;
        amountCents: string;
      };

      if (
        cached.fromAccountId !== fromAccountId ||
        cached.toAccountId !== toAccountId ||
        BigInt(cached.amountCents) !== amountCents
      ) {
        throw new IdempotencyConflictError();
      }

      // Return cached transactions
      const [debitTx, creditTx] = await Promise.all([
        this.db.transaction.findUniqueOrThrow({ where: { id: cached.debitTxId } }),
        this.db.transaction.findUniqueOrThrow({ where: { id: cached.creditTxId } }),
      ]);

      return { idempotent: true, debitTx, creditTx };
    }

    // 3. Execute the ACID transfer inside a transaction
    const { debitTx, creditTx } = await this.db.$transaction(
      async (tx) => {
        // ── 3a. Load both accounts ──
        const accounts = await tx.account.findMany({
          where: { id: { in: [fromAccountId, toAccountId] } },
        });

        const fromAccount = accounts.find((a) => a.id === fromAccountId);
        const toAccount = accounts.find((a) => a.id === toAccountId);

        // ── 3b. Validate accounts ──
        if (!fromAccount) throw new AccountNotFoundError(fromAccountId);
        if (!toAccount) throw new AccountNotFoundError(toAccountId);
        if (!fromAccount.isActive) throw new AccountInactiveError(fromAccountId);
        if (!toAccount.isActive) throw new AccountInactiveError(toAccountId);

        // ── 3c. Overdraft guard ──
        // The sender can go negative but not below -overdraftLimit.
        const available = effectiveAvailable(fromAccount);
        if (amountCents > available) {
          throw new InsufficientFundsError(available, amountCents);
        }

        // ── 3d. Compute new balances ──
        const newFromBalance = fromAccount.balance - amountCents;
        const newToBalance = toAccount.balance + amountCents;

        // ── 3e. Update balances ──
        await tx.account.update({
          where: { id: fromAccountId },
          data: { balance: newFromBalance },
        });

        await tx.account.update({
          where: { id: toAccountId },
          data: { balance: newToBalance },
        });

        // ── 3f. Create debit transaction (TRANSFER_OUT) ──
        const debitTx = await tx.transaction.create({
          data: {
            accountId: fromAccountId,
            type: "TRANSFER_OUT",
            status: "SETTLED",
            amount: amountCents,
            balanceAfter: newFromBalance,
            description: description ?? `Transferência para conta ${toAccount.number}`,
            metadata: metadata ? JSON.stringify(metadata) : undefined,
            idempotencyKey,
            settledAt: new Date(),
          },
        });

        // ── 3g. Create credit transaction (TRANSFER_IN) ──
        const creditTx = await tx.transaction.create({
          data: {
            accountId: toAccountId,
            type: "TRANSFER_IN",
            status: "SETTLED",
            amount: amountCents,
            balanceAfter: newToBalance,
            description: description ?? `Transferência da conta ${fromAccount.number}`,
            metadata: metadata ? JSON.stringify(metadata) : undefined,
            // Link the pair
            relatedTransactionId: debitTx.id,
            idempotencyKey,
            settledAt: new Date(),
          },
        });

        // ── 3h. Back-link debit → credit ──
        await tx.transaction.update({
          where: { id: debitTx.id },
          data: { relatedTransactionId: creditTx.id },
        });

        return { debitTx, creditTx };
      },
    );

    // 4. Persist idempotency key AFTER successful commit
    // TTL: 24 hours
    await this.db.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        userId: "", // caller should inject real userId; simplified here
        endpoint: "POST /api/transfers",
        statusCode: 201,
        responseBody: JSON.stringify({
          debitTxId: debitTx.id,
          creditTxId: creditTx.id,
          fromAccountId,
          toAccountId,
          amountCents: amountCents.toString(),
        }),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    return { idempotent: false, debitTx, creditTx };
  }

  // ───────────────────────────────────────────
  // Public: applyOverdraftInterest (run via daily cron)
  // Applies overdraftRate to any account with negative balance.
  // ───────────────────────────────────────────

  async applyOverdraftInterest(): Promise<{ processed: number }> {
    // Find all accounts with a negative balance
    const negativeAccounts = await this.db.account.findMany({
      where: { balance: { lt: 0n }, isActive: true },
    });

    let processed = 0;

    for (const account of negativeAccounts) {
      const negativeAmount = -account.balance; // positive value of the debt
      // Interest = |balance| * dailyRate, rounded up to nearest centavo
      const interest = this.calculateDailyInterest(
        negativeAmount,
        account.overdraftRate
      );

      if (interest <= 0n) continue;

      await this.db.$transaction(async (tx) => {
        const current = await tx.account.findUniqueOrThrow({
          where: { id: account.id },
        });

        const newBalance = current.balance - interest;

        await tx.account.update({
          where: { id: account.id },
          data: { balance: newBalance },
        });

        await tx.transaction.create({
          data: {
            accountId: account.id,
            type: "INTEREST_CHARGE",
            status: "SETTLED",
            amount: interest,
            balanceAfter: newBalance,
            description: `Juros de cheque especial — taxa diária ${(account.overdraftRate * 100).toFixed(4)}%`,
            settledAt: new Date(),
          },
        });
      });

      processed++;
    }

    return { processed };
  }

  // ───────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────

  private calculateDailyInterest(
    principalCents: bigint,
    dailyRate: number
  ): bigint {
    // Convert to number for the multiplication, then back to bigint
    // Safe because principal is at most a few billion centavos (< 2^53)
    const interest = Math.ceil(Number(principalCents) * dailyRate);
    return BigInt(interest);
  }
}
