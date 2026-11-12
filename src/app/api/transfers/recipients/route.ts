import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler, requireAuth } from "@/lib/apiHelpers";

/**
 * GET /api/transfers/recipients?q=... — active users who can receive a transfer.
 * Full account numbers stay private; the transfer uses the returned accountId.
 */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const accounts = await prisma.account.findMany({
    where: {
      isActive: true,
      userId: { not: userId },
      user: {
        status: "ACTIVE",
        ...(q ? { fullName: { contains: q } } : {}),
      },
    },
    select: {
      id: true,
      number: true,
      agency: true,
      user: { select: { fullName: true } },
    },
    orderBy: { user: { fullName: "asc" } },
    take: 30,
  });

  return ok(
    accounts.map((a) => ({
      accountId: a.id,
      holderName: a.user.fullName,
      agency: a.agency,
      maskedNumber: `****${a.number.slice(-4)}`,
    }))
  );
});
