/**
 * Cron: apply overdraft interest
 * Run daily at 00:05 AM via your scheduler (Vercel Cron, GitHub Actions, etc.)
 * Secured by CRON_SECRET header.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { TransactionService } from "@/services/TransactionService";

export const POST = async (request: NextRequest): Promise<NextResponse> => {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const service = new TransactionService(prisma);
    const { processed } = await service.applyOverdraftInterest();

    console.log(`[cron:overdraft-interest] processed=${processed}`);
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    console.error("[cron:overdraft-interest]", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
};
