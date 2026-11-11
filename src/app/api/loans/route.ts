import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { LoanService } from "@/services/LoanService";
import { ok, created, withErrorHandler, requireAuth, parseBody } from "@/lib/apiHelpers";

const takeSchema = z.object({
  accountId:         z.string().cuid(),
  principalCents:    z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  annualRatePercent: z.number().positive().max(500),
  termMonths:        z.number().int().min(1).max(60),
});

/** GET /api/loans — list loans for user */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);

  const loans = await prisma.loan.findMany({
    where: { userId },
    include: {
      installments: {
        orderBy: { number: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const serialised = loans.map((l) => ({
    ...l,
    principalAmount:    l.principalAmount.toString(),
    disbursedAmount:    l.disbursedAmount?.toString() ?? null,
    installmentAmount:  l.installmentAmount.toString(),
    totalPayable:       l.totalPayable.toString(),
    annualRate:         l.annualRate.toString(),
    monthlyRate:        l.monthlyRate.toString(),
    cet:                l.cet?.toString() ?? null,
    installments: l.installments.map((i) => ({
      ...i,
      principalPortion: i.principalPortion.toString(),
      interestPortion:  i.interestPortion.toString(),
      totalDue:         i.totalDue.toString(),
      lateFee:          i.lateFee.toString(),
      lateInterest:     i.lateInterest.toString(),
      paidAmount:       i.paidAmount.toString(),
    })),
  }));

  return ok(serialised);
});

/** POST /api/loans — take a loan */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);
  const input = await parseBody(request, takeSchema);
  const service = new LoanService(prisma);
  const result = await service.takeLoan({ ...input, userId });
  return created(result);
});
