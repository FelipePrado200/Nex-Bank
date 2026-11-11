import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler, requireAuth } from "@/lib/apiHelpers";

/** GET /api/accounts — list accounts for the authenticated user */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);

  const accounts = await prisma.account.findMany({
    where: { userId, isActive: true },
    select: {
      id: true,
      type: true,
      number: true,
      agency: true,
      balance: true,
      overdraftLimit: true,
      createdAt: true,
      _count: { select: { transactions: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // BigInt → string for JSON serialisation
  const serialised = accounts.map((a) => ({
    ...a,
    balance: a.balance.toString(),
    overdraftLimit: a.overdraftLimit.toString(),
  }));

  return ok(serialised);
});
