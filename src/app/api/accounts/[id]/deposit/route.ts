import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler, requireAuth, parseBody } from "@/lib/apiHelpers";

const MAX_DEPOSIT = 50_000_00n; // R$ 50.000,00

const schema = z.object({
  amountCents: z
    .string()
    .regex(/^\d+$/, "Valor inválido.")
    .transform((v) => BigInt(v)),
});

/** POST /api/accounts/[id]/deposit — credit funds into an account (demo feature) */
export const POST = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const { userId } = requireAuth(request);
  const accountId = context?.params.id ?? "";
  const { amountCents } = await parseBody(request, schema);

  if (amountCents <= 0n) throw new Error("O valor deve ser maior que zero.");
  if (amountCents > MAX_DEPOSIT) throw new Error("O valor máximo por depósito é R$ 50.000,00.");

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId, isActive: true },
  });
  if (!account) throw new Error("Conta não encontrada.");

  const updated = await prisma.$transaction(async (tx) => {
    const acc = await tx.account.update({
      where: { id: accountId },
      data: { balance: { increment: amountCents } },
    });

    await tx.transaction.create({
      data: {
        accountId,
        type: "DEPOSIT",
        status: "SETTLED",
        amount: amountCents,
        balanceAfter: acc.balance,
        description: "Depósito em conta",
        settledAt: new Date(),
      },
    });

    return acc;
  });

  return ok({
    balance: updated.balance.toString(),
    amountCents: amountCents.toString(),
  });
});
