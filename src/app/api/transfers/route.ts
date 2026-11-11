import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TransactionService } from "@/services/TransactionService";
import {
  created, withErrorHandler, requireAuth,
  parseBody, checkRateLimit, getIp,
} from "@/lib/apiHelpers";
import { RATE_LIMITS } from "@/lib/rateLimit";

const schema = z.object({
  idempotencyKey: z.string().uuid("Chave de idempotência deve ser UUID v4."),
  fromAccountId:  z.string().cuid(),
  toAccountId:    z.string().cuid(),
  /** Amount in centavos as a string (avoid JSON BigInt issues) */
  amountCents:    z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  description:    z.string().max(120).optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = requireAuth(request);
  checkRateLimit(request, `transfer:${auth.userId}`, RATE_LIMITS.transfer);

  const input = await parseBody(request, schema);

  // Verify the fromAccount belongs to the authenticated user
  const account = await prisma.account.findFirst({
    where: { id: input.fromAccountId, userId: auth.userId },
  });
  if (!account) {
    return created({ error: "Conta de origem não encontrada." });
  }

  const service = new TransactionService(prisma);
  const result = await service.transfer({ ...input, metadata: { initiatedBy: auth.userId } });

  return created({
    idempotent: result.idempotent,
    debitTransactionId: result.debitTx.id,
    creditTransactionId: result.creditTx.id,
    amountCents: input.amountCents.toString(),
  });
});
