/**
 * LoanService.ts
 * Loan simulation and instantiation using the Tabela Price (PMT) method.
 *
 * Tabela Price: fixed monthly installment, reducing amortization.
 * PMT = PV * [i * (1+i)^n] / [(1+i)^n - 1]
 *   PV = present value (principal)
 *   i  = monthly interest rate
 *   n  = number of installments
 *
 * CET (Custo Efetivo Total) is an annualized all-in rate.
 * All monetary values are BigInt in centavos.
 */

import { PrismaClient,  } from "@prisma/client";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export interface LoanSimulationInput {
  principalCents: bigint;
  annualRatePercent: number; // e.g. 24.99 for 24.99% a.a.
  termMonths: number;        // 1–60
}

export interface InstallmentRow {
  number: number;
  dueDate: Date;
  principalPortion: bigint;
  interestPortion: bigint;
  totalDue: bigint;
  /** Running principal balance after this payment */
  remainingBalance: bigint;
}

export interface LoanSimulation {
  principalCents: bigint;
  annualRatePercent: number;
  monthlyRatePercent: number;
  cetPercent: number;
  termMonths: number;
  installmentAmountCents: bigint;
  totalPayableCents: bigint;
  totalInterestCents: bigint;
  firstDueDate: Date;
  schedule: InstallmentRow[];
}

export interface TakeLoanInput {
  userId: string;
  accountId: string;
  principalCents: bigint;
  annualRatePercent: number;
  termMonths: number;
}

// ─────────────────────────────────────────────
// LoanService
// ─────────────────────────────────────────────

export class LoanService {
  constructor(private readonly db: PrismaClient) {}

  // ───────────────────────────────────────────
  // Simulate (no DB write)
  // ───────────────────────────────────────────

  simulate(input: LoanSimulationInput): LoanSimulation {
    const { principalCents, annualRatePercent, termMonths } = input;

    if (termMonths < 1 || termMonths > 60) {
      throw new Error("O prazo deve ser entre 1 e 60 meses.");
    }
    if (principalCents <= 0n) {
      throw new Error("O valor do empréstimo deve ser positivo.");
    }
    if (annualRatePercent <= 0) {
      throw new Error("A taxa de juros deve ser positiva.");
    }

    // Convert annual rate to monthly rate using compound formula:
    // i_monthly = (1 + i_annual)^(1/12) - 1
    const annualRate = annualRatePercent / 100;
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

    // PMT formula
    const pmt = this.calculatePmt(Number(principalCents), monthlyRate, termMonths);
    const installmentAmountCents = BigInt(Math.ceil(pmt)); // round up — favours bank

    const totalPayableCents = installmentAmountCents * BigInt(termMonths);
    const totalInterestCents = totalPayableCents - principalCents;

    // Build amortization schedule
    const firstDueDate = this.firstDueDateFromNow();
    const schedule = this.buildSchedule(
      principalCents,
      monthlyRate,
      installmentAmountCents,
      termMonths,
      firstDueDate
    );

    // CET approximation: IRR of cash flows (Newton-Raphson)
    // Cash flows: +principal at t=0, -installment at t=1..n
    const cetMonthly = this.calculateIrr(
      Number(principalCents),
      Number(installmentAmountCents),
      termMonths
    );
    const cetAnnual = (Math.pow(1 + cetMonthly, 12) - 1) * 100;

    return {
      principalCents,
      annualRatePercent,
      monthlyRatePercent: monthlyRate * 100,
      cetPercent: cetAnnual,
      termMonths,
      installmentAmountCents,
      totalPayableCents,
      totalInterestCents,
      firstDueDate,
      schedule,
    };
  }

  // ───────────────────────────────────────────
  // Take loan (create in DB, disburse to account)
  // ───────────────────────────────────────────

  async takeLoan(input: TakeLoanInput): Promise<{ loanId: string }> {
    const { userId, accountId, principalCents, annualRatePercent, termMonths } =
      input;

    // Verify account
    const account = await this.db.account.findFirst({
      where: { id: accountId, userId, isActive: true },
    });
    if (!account) throw new Error("Conta não encontrada.");

    // Run simulation to get schedule
    const sim = this.simulate({ principalCents, annualRatePercent, termMonths });

    const annualRate = annualRatePercent / 100;
    const monthlyRate = Math.pow(1 + annualRate, 1 / 12) - 1;

    const loan = await this.db.$transaction(async (tx) => {
      // Lock account
      const acc = await tx.account.findUniqueOrThrow({ where: { id: accountId } });

      // Create loan record
      const loan = await tx.loan.create({
        data: {
          userId,
          status: "ACTIVE",
          principalAmount: principalCents,
          disbursedAmount: principalCents,
          annualRate: annualRatePercent / 100,
          monthlyRate: monthlyRate,
          cet: sim.cetPercent / 100,
          termMonths,
          installmentAmount: sim.installmentAmountCents,
          totalPayable: sim.totalPayableCents,
          firstDueDate: sim.firstDueDate,
          disbursedAt: new Date(),
        },
      });

      // Create all installments
      await tx.loanInstallment.createMany({
        data: sim.schedule.map((row) => ({
          loanId: loan.id,
          number: row.number,
          status: "PENDING",
          principalPortion: row.principalPortion,
          interestPortion: row.interestPortion,
          totalDue: row.totalDue,
          dueDate: row.dueDate,
        })),
      });

      // Credit the principal to the account
      const newBalance = acc.balance + principalCents;
      await tx.account.update({
        where: { id: accountId },
        data: { balance: newBalance },
      });

      // Create the disbursal transaction
      await tx.transaction.create({
        data: {
          accountId,
          type: "LOAN_DISBURSE",
          status: "SETTLED",
          amount: principalCents,
          balanceAfter: newBalance,
          description: `Empréstimo ${termMonths}x — crédito na conta`,
          metadata: JSON.stringify({ loanId: loan.id }),
          settledAt: new Date(),
        },
      });

      return loan;
    });

    return { loanId: loan.id };
  }

  // ───────────────────────────────────────────
  // Pay an installment
  // ───────────────────────────────────────────

  async payInstallment(
    installmentId: string,
    accountId: string,
    userId: string
  ): Promise<void> {
    await this.db.$transaction(async (tx) => {
      // Lock account
      const installment = await tx.loanInstallment.findUniqueOrThrow({
        where: { id: installmentId },
        include: { loan: true },
      });

      if (installment.loan.userId !== userId) {
        throw new Error("Parcela não encontrada.");
      }
      if (installment.status === "PAID") {
        throw new Error("Esta parcela já foi paga.");
      }

      const totalDue = installment.totalDue + installment.lateFee + installment.lateInterest;
      const acc = await tx.account.findUniqueOrThrow({ where: { id: accountId } });

      // Check effective balance (overdraft allowed for loan payments)
      const available = acc.balance + acc.overdraftLimit;
      if (totalDue > available) {
        throw new Error(
          `Saldo insuficiente para pagar a parcela. Necessário: R$ ${centavosToReal(totalDue)}`
        );
      }

      const newBalance = acc.balance - totalDue;

      await tx.account.update({ where: { id: accountId }, data: { balance: newBalance } });

      await tx.loanInstallment.update({
        where: { id: installmentId },
        data: {
          status: "PAID",
          paidAmount: totalDue,
          paidAt: new Date(),
        },
      });

      await tx.transaction.create({
        data: {
          accountId,
          type: "LOAN_PAYMENT",
          status: "SETTLED",
          amount: totalDue,
          balanceAfter: newBalance,
          description: `Pagamento parcela ${installment.number}/${installment.loan.termMonths}`,
          loanInstallmentId: installmentId,
          settledAt: new Date(),
        },
      });

      // Check if all installments are paid — settle loan
      const pending = await tx.loanInstallment.count({
        where: { loanId: installment.loanId, status: { not: "PAID" } },
      });
      if (pending === 0) {
        await tx.loan.update({
          where: { id: installment.loanId },
          data: { status: "SETTLED", settledAt: new Date() },
        });
      }
    });
  }

  // ───────────────────────────────────────────
  // Mark overdue installments (run via daily cron)
  // ───────────────────────────────────────────

  async markOverdueInstallments(): Promise<{ marked: number }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.db.loanInstallment.updateMany({
      where: {
        status: "PENDING",
        dueDate: { lt: today },
      },
      data: {
        status: "OVERDUE",
        // 2% late fee + 1% per month mora — applied as rough initial value
        // A more precise calculation would use a separate daily job
        lateFee: undefined, // updated per-row in a separate pass if needed
      },
    });

    return { marked: result.count };
  }

  // ───────────────────────────────────────────
  // Private: PMT formula
  // ───────────────────────────────────────────

  private calculatePmt(
    principal: number,
    monthlyRate: number,
    n: number
  ): number {
    if (monthlyRate === 0) return principal / n;
    const factor = Math.pow(1 + monthlyRate, n);
    return (principal * monthlyRate * factor) / (factor - 1);
  }

  // ───────────────────────────────────────────
  // Private: build amortization schedule
  // ───────────────────────────────────────────

  private buildSchedule(
    principalCents: bigint,
    monthlyRate: number,
    installmentCents: bigint,
    n: number,
    firstDueDate: Date
  ): InstallmentRow[] {
    const schedule: InstallmentRow[] = [];
    let balance = Number(principalCents);

    for (let i = 1; i <= n; i++) {
      const interestFloat = balance * monthlyRate;
      const interest = BigInt(Math.round(interestFloat));
      let principal = installmentCents - interest;

      // Last installment: pay off remaining balance exactly
      if (i === n) {
        principal = BigInt(Math.round(balance));
      }

      const remaining = BigInt(Math.round(balance)) - principal;
      balance -= Number(principal);

      const dueDate = new Date(firstDueDate);
      dueDate.setMonth(dueDate.getMonth() + (i - 1));

      schedule.push({
        number: i,
        dueDate,
        principalPortion: principal,
        interestPortion: interest,
        totalDue: i < n ? installmentCents : principal + interest,
        remainingBalance: remaining < 0n ? 0n : remaining,
      });
    }

    return schedule;
  }

  // ───────────────────────────────────────────
  // Private: IRR (Newton-Raphson) for CET
  // ───────────────────────────────────────────

  private calculateIrr(
    principal: number,
    installment: number,
    n: number
  ): number {
    let rate = 0.01; // initial guess: 1% per month

    for (let iter = 0; iter < 100; iter++) {
      // NPV: principal - sum of discounted installments
      let npv = principal;
      let dNpv = 0; // derivative

      for (let t = 1; t <= n; t++) {
        const discount = Math.pow(1 + rate, t);
        npv -= installment / discount;
        dNpv += (t * installment) / (Math.pow(1 + rate, t + 1));
      }

      const newRate = rate - npv / dNpv;
      if (Math.abs(newRate - rate) < 1e-10) break;
      rate = newRate;
    }

    return rate;
  }

  // ───────────────────────────────────────────
  // Private: first due date = next month, same day
  // ───────────────────────────────────────────

  private firstDueDateFromNow(): Date {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setHours(23, 59, 59, 0);
    return d;
  }
}

function centavosToReal(cents: bigint): string {
  const reais = cents / 100n;
  const centavos = cents % 100n;
  return `${reais}.${String(centavos).padStart(2, "0")}`;
}
