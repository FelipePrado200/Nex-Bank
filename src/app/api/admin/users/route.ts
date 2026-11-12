import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler } from "@/lib/apiHelpers";
import { requireAdmin } from "@/lib/requireAdmin";

/** GET /api/admin/users?q=... — users with account totals and platform stats */
export const GET = withErrorHandler(async (request: NextRequest) => {
  await requireAdmin(request);
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  const [users, totalUsers, activeUsers, balanceSum] = await Promise.all([
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { fullName: { contains: q } },
              { email: { contains: q } },
              { taxId: { contains: q } },
            ],
          }
        : undefined,
      select: {
        id: true,
        fullName: true,
        email: true,
        taxId: true,
        status: true,
        role: true,
        createdAt: true,
        accounts: { select: { balance: true, isActive: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.account.aggregate({ _sum: { balance: true } }),
  ]);

  return ok({
    stats: {
      totalUsers,
      activeUsers,
      totalBalance: (balanceSum._sum.balance ?? 0n).toString(),
    },
    users: users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      taxIdMasked: `***${u.taxId.slice(-4)}`,
      status: u.status,
      role: u.role,
      createdAt: u.createdAt,
      accountCount: u.accounts.filter((a) => a.isActive).length,
      totalBalance: u.accounts
        .filter((a) => a.isActive)
        .reduce((sum, a) => sum + a.balance, 0n)
        .toString(),
    })),
  });
});
