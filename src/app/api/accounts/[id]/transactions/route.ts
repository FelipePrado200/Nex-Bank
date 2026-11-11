import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler, requireAuth, notFound } from "@/lib/apiHelpers";

/** GET /api/accounts/[id]/transactions — ledger for one account */
export const GET = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const { userId } = requireAuth(request);
  const accountId = context?.params.id ?? "";

  // Verify ownership
  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  });
  if (!account) return notFound("Conta");

  const url = new URL(request.url);
  const take = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 200);
  const skip = parseInt(url.searchParams.get("offset") ?? "0");

  const transactions = await prisma.transaction.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take,
    skip,
  });

  const serialised = transactions.map((tx) => ({
    ...tx,
    amount:       tx.amount.toString(),
    balanceAfter: tx.balanceAfter.toString(),
  }));

  return ok(serialised);
});
