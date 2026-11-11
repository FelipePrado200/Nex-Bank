import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { InvoiceService } from "@/services/InvoiceService";
import { ok, withErrorHandler, requireAuth, parseBody } from "@/lib/apiHelpers";

const schema = z.object({
  accountId:   z.string().cuid(),
  amountCents: z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
});

/** POST /api/invoices/[id]/pay — pay an invoice (partial or full) */
export const POST = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const { userId } = requireAuth(request);
  const invoiceId = context?.params.id ?? "";
  const { accountId, amountCents } = await parseBody(request, schema);

  const service = new InvoiceService(prisma);
  await service.payInvoice({ invoiceId, accountId, userId, amountCents });

  return ok({ message: "Pagamento realizado com sucesso." });
});
