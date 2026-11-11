import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, withErrorHandler, requireAuth } from "@/lib/apiHelpers";

/** GET /api/invoices — list invoices for the authenticated user */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);

  const invoices = await prisma.invoice.findMany({
    where: { account: { userId } },
    include: {
      card: { select: { lastFour: true, network: true, color: true } },
      items: { orderBy: { purchasedAt: "desc" } },
    },
    orderBy: { dueDate: "desc" },
    take: 12,
  });

  const serialised = invoices.map((inv) => ({
    id: inv.id,
    cardId: inv.cardId,
    accountId: inv.accountId,
    status: inv.status,
    cycleStart: inv.cycleStart.toISOString(),
    cycleEnd: inv.cycleEnd.toISOString(),
    dueDate: inv.dueDate.toISOString(),
    totalAmount: inv.totalAmount.toString(),
    paidAmount: inv.paidAmount.toString(),
    minimumPayment: inv.minimumPayment.toString(),
    closedAt: inv.closedAt?.toISOString() ?? null,
    paidAt: inv.paidAt?.toISOString() ?? null,
    card: inv.card,
    items: inv.items.map((item) => ({
      id: item.id,
      description: item.description,
      amount: item.amount.toString(),
      instalmentOf: item.instalmentOf,
      instalmentTotal: item.instalmentTotal,
      purchasedAt: item.purchasedAt.toISOString(),
    })),
  }));

  return ok(serialised);
});
