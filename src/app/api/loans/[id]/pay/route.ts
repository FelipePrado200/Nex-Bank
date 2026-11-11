import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { LoanService } from "@/services/LoanService";
import { ok, withErrorHandler, requireAuth, parseBody } from "@/lib/apiHelpers";

const schema = z.object({
  installmentId: z.string().cuid(),
  accountId:     z.string().cuid(),
});

/** POST /api/loans/[id]/pay — pay one installment */
export const POST = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const { userId } = requireAuth(request);
  const { installmentId, accountId } = await parseBody(request, schema);

  const service = new LoanService(prisma);
  await service.payInstallment(installmentId, accountId, userId);

  return ok({ message: "Parcela paga com sucesso." });
});
