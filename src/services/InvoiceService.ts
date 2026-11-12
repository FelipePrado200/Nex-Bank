/**
 * InvoiceService.ts
 * Credit card invoice state machine.
 *
 * State transitions:
 *   OPEN  ──(cycle end)──► CLOSED  ──(paid in full)──► PAID
 *                                   ──(past due date)──► OVERDUE
 *                                   ──(partial pay)───► PARTIAL → (paid in full) → PAID
 *
 * - Each billing cycle has one OPEN invoice per card.
 * - On cycle close: totalAmount is locked, minimumPayment is set (15% floor 10 BRL).
 * - On payment: availableLimit on the card is restored by the paid amount.
 * - Minimum payment: max(totalAmount * 0.15, 1000) centavos (R$ 10.00)
 */

import { Prisma, PrismaClient } from "@prisma/client";

const MINIMUM_PAYMENT_RATE = 0.15;      // 15% of total
const MINIMUM_PAYMENT_FLOOR = 1000n;    // R$ 10.00 in centavos

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface AddPurchaseInput {
  cardId: string;
  accountId: string;
  description: string;
  amountCents: bigint;
  purchasedAt?: Date;
  instalmentOf?: number;
  instalmentTotal?: number;
}

export interface PayInvoiceInput {
  invoiceId: string;
  accountId: string;
  userId: string;
  /** Amount to pay in centavos. Must be >= minimumPayment. */
  amountCents: bigint;
}

// ─────────────────────────────────────────────
// InvoiceService
// ─────────────────────────────────────────────

export class InvoiceService {
  constructor(private readonly db: PrismaClient) {}

  // ───────────────────────────────────────────
  // Get or create the OPEN invoice for a card
  // ───────────────────────────────────────────

  /**
   * Pass `client` (the `tx` of an interactive transaction) when calling from inside one.
   * Using `this.db` there would open a second connection and wait on the write lock the
   * transaction already holds.
   */
  async getOrCreateOpenInvoice(
    cardId: string,
    accountId: string,
    client: PrismaClient | Prisma.TransactionClient = this.db
  ): Promise<string> {
    const existing = await client.invoice.findFirst({
      where: { cardId, status: "OPEN" },
    });
    if (existing) return existing.id;

    // Create a new cycle: starts today, ends in ~30 days, due in ~40 days
    const now = new Date();
    const cycleEnd = new Date(now);
    cycleEnd.setDate(cycleEnd.getDate() + 30);
    const dueDate = new Date(cycleEnd);
    dueDate.setDate(dueDate.getDate() + 10);

    const invoice = await client.invoice.create({
      data: {
        cardId,
        accountId,
        status: "OPEN",
        cycleStart: now,
        cycleEnd,
        dueDate,
        totalAmount: 0n,
        paidAmount: 0n,
        minimumPayment: 0n,
      },
    });

    return invoice.id;
  }

  // ───────────────────────────────────────────
  // Add a purchase to the open invoice
  // ───────────────────────────────────────────

  async addPurchase(input: AddPurchaseInput): Promise<void> {
    const {
      cardId,
      accountId,
      description,
      amountCents,
      purchasedAt = new Date(),
      instalmentOf,
      instalmentTotal,
    } = input;

    if (amountCents <= 0n) throw new Error("O valor da compra deve ser positivo.");

    // Verify card is active
    const card = await this.db.creditCard.findFirst({
      where: { id: cardId, status: "ACTIVE" },
    });
    if (!card) throw new Error("Cartão não encontrado ou bloqueado.");

    await this.db.$transaction(async (tx) => {
      // Lock card for limit check
      const lockedCard = await tx.creditCard.findUniqueOrThrow({ where: { id: cardId } });

      if (lockedCard.availableLimit < amountCents) {
        throw new Error(
          `Limite insuficiente. Disponível: R$ ${centavosToReal(lockedCard.availableLimit)}`
        );
      }

      // Deduct available limit
      await tx.creditCard.update({
        where: { id: cardId },
        data: { availableLimit: lockedCard.availableLimit - amountCents },
      });

      // Get open invoice
      const invoiceId = await this.getOrCreateOpenInvoice(cardId, accountId, tx);

      // Lock invoice
      // Create invoice item
      const item = await tx.invoiceItem.create({
        data: {
          invoiceId,
          description,
          amount: amountCents,
          purchasedAt,
          instalmentOf,
          instalmentTotal,
        },
      });

      // Update invoice total
      await tx.invoice.update({
        where: { id: invoiceId },
        data: { totalAmount: { increment: amountCents } },
      });

      // Create the transaction record
      await tx.transaction.create({
        data: {
          accountId,
          type: "CARD_PURCHASE",
          status: "SETTLED",
          amount: amountCents,
          balanceAfter: 0n, // credit card purchases don't affect debit balance
          description: `Compra: ${description}`,
          invoiceItemId: item.id,
          settledAt: purchasedAt,
        },
      });
    });
  }

  // ───────────────────────────────────────────
  // Close invoice (move OPEN → CLOSED, lock amounts)
  // Run via monthly cron
  // ───────────────────────────────────────────

  async closeInvoice(invoiceId: string): Promise<void> {
    const invoice = await this.db.invoice.findUniqueOrThrow({
      where: { id: invoiceId },
    });

    if (invoice.status !== "OPEN") {
      throw new Error("A fatura não está aberta.");
    }

    const minimumPayment = this.calculateMinimumPayment(invoice.totalAmount);

    await this.db.invoice.update({
      where: { id: invoiceId },
      data: {
        status: "CLOSED",
        minimumPayment,
        closedAt: new Date(),
      },
    });
  }

  // ───────────────────────────────────────────
  // Pay invoice (partial or full)
  // ───────────────────────────────────────────

  async payInvoice(input: PayInvoiceInput): Promise<void> {
    const { invoiceId, accountId, userId, amountCents } = input;

    if (amountCents <= 0n) throw new Error("O valor do pagamento deve ser positivo.");

    await this.db.$transaction(async (tx) => {
      // Lock account
      // Lock invoice
      const invoice = await tx.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
      const acc = await tx.account.findUniqueOrThrow({ where: { id: accountId } });

      if (!["OPEN", "CLOSED", "OVERDUE", "PARTIAL"].includes(invoice.status)) {
        throw new Error("Esta fatura não está disponível para pagamento.");
      }

      // Must pay at least minimum
      if (amountCents < invoice.minimumPayment) {
        throw new Error(
          `O pagamento mínimo é R$ ${centavosToReal(invoice.minimumPayment)}.`
        );
      }

      // Cannot overpay
      const outstanding = invoice.totalAmount - invoice.paidAmount;
      const toPay = amountCents > outstanding ? outstanding : amountCents;

      // Check account balance
      const available = acc.balance + acc.overdraftLimit;
      if (toPay > available) {
        throw new Error(
          `Saldo insuficiente. Disponível: R$ ${centavosToReal(available)}`
        );
      }

      const newBalance = acc.balance - toPay;
      const newPaid = invoice.paidAmount + toPay;
      const isFullyPaid = newPaid >= invoice.totalAmount;

      await tx.account.update({
        where: { id: accountId },
        data: { balance: newBalance },
      });

      await tx.invoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaid,
          status: isFullyPaid ? "PAID" : "PARTIAL",
          paidAt: isFullyPaid ? new Date() : undefined,
        },
      });

      // Restore card limit for the paid amount
      await tx.creditCard.update({
        where: { id: invoice.cardId },
        data: { availableLimit: { increment: toPay } },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          accountId,
          type: "INVOICE_PAYMENT",
          status: "SETTLED",
          amount: toPay,
          balanceAfter: newBalance,
          description: `Pagamento fatura cartão ****${invoice.cardId.slice(-4)}`,
          settledAt: new Date(),
        },
      });
    });
  }

  // ───────────────────────────────────────────
  // Mark overdue invoices (run via daily cron)
  // ───────────────────────────────────────────

  async markOverdueInvoices(): Promise<{ marked: number }> {
    const now = new Date();

    const result = await this.db.invoice.updateMany({
      where: {
        status: { in: ["CLOSED", "PARTIAL"] },
        dueDate: { lt: now },
      },
      data: { status: "OVERDUE" },
    });

    return { marked: result.count };
  }

  // ───────────────────────────────────────────
  // Close all open invoices past their cycle end (cron)
  // ───────────────────────────────────────────

  async closeExpiredInvoices(): Promise<{ closed: number }> {
    const now = new Date();

    const expired = await this.db.invoice.findMany({
      where: {
        status: "OPEN",
        cycleEnd: { lt: now },
      },
    });

    for (const inv of expired) {
      await this.closeInvoice(inv.id);
    }

    return { closed: expired.length };
  }

  // ───────────────────────────────────────────
  // List invoices for a card
  // ───────────────────────────────────────────

  async listInvoices(cardId: string, userId: string) {
    const card = await this.db.creditCard.findFirst({
      where: { id: cardId, userId },
    });
    if (!card) throw new Error("Cartão não encontrado.");

    return this.db.invoice.findMany({
      where: { cardId },
      include: { items: true },
      orderBy: { cycleStart: "desc" },
    });
  }

  // ───────────────────────────────────────────
  // Private: minimum payment
  // max(total * 15%, R$ 10.00)
  // ───────────────────────────────────────────

  private calculateMinimumPayment(totalCents: bigint): bigint {
    const fifteen = BigInt(Math.ceil(Number(totalCents) * MINIMUM_PAYMENT_RATE));
    return fifteen > MINIMUM_PAYMENT_FLOOR ? fifteen : MINIMUM_PAYMENT_FLOOR;
  }
}

function centavosToReal(cents: bigint): string {
  const reais = cents / 100n;
  const centavos = cents % 100n;
  return `${reais}.${String(centavos).padStart(2, "0")}`;
}
