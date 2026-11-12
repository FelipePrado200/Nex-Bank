/**
 * Cron: close expired invoice cycles + mark overdue invoices + mark overdue installments
 * Run daily at 00:10 AM.
 * Secured by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { InvoiceService } from "@/services/InvoiceService";
import { LoanService } from "@/services/LoanService";

export const GET = async (request: NextRequest): Promise<NextResponse> => {
  // Vercel Cron sends: Authorization: Bearer <CRON_SECRET>
  const auth = request.headers.get("authorization");
  const secret = auth?.startsWith("Bearer ") ? auth.slice(7) : request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const invoiceService = new InvoiceService(prisma);
    const loanService    = new LoanService(prisma);

    const [closedResult, overdueInvoices, overdueInstallments] = await Promise.all([
      invoiceService.closeExpiredInvoices(),
      invoiceService.markOverdueInvoices(),
      loanService.markOverdueInstallments(),
    ]);

    const summary = {
      invoicesClosed:    closedResult.closed,
      invoicesOverdue:   overdueInvoices.marked,
      installmentsOverdue: overdueInstallments.marked,
    };

    console.log("[cron:close-invoices]", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    console.error("[cron:close-invoices]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
};
