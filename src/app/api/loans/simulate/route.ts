import { NextRequest } from "next/server";
import { z } from "zod";
import { LoanService } from "@/services/LoanService";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler, requireAuth, parseBody } from "@/lib/apiHelpers";

const schema = z.object({
  principalCents:    z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  annualRatePercent: z.number().positive().max(500),
  termMonths:        z.number().int().min(1).max(60),
});

/** POST /api/loans/simulate — simulate a loan (no DB write) */
export const POST = withErrorHandler(async (request: NextRequest) => {
  requireAuth(request);
  const input = await parseBody(request, schema);
  const service = new LoanService(prisma);
  const sim = service.simulate(input);

  return ok({
    principalCents:        sim.principalCents.toString(),
    annualRatePercent:     sim.annualRatePercent,
    monthlyRatePercent:    sim.monthlyRatePercent,
    cetPercent:            sim.cetPercent,
    termMonths:            sim.termMonths,
    installmentAmountCents: sim.installmentAmountCents.toString(),
    totalPayableCents:     sim.totalPayableCents.toString(),
    totalInterestCents:    sim.totalInterestCents.toString(),
    firstDueDate:          sim.firstDueDate.toISOString(),
    schedule: sim.schedule.map((r) => ({
      number:            r.number,
      dueDate:           r.dueDate.toISOString(),
      principalPortion:  r.principalPortion.toString(),
      interestPortion:   r.interestPortion.toString(),
      totalDue:          r.totalDue.toString(),
      remainingBalance:  r.remainingBalance.toString(),
    })),
  });
});
