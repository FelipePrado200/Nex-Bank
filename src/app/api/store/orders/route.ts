import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  ok, created, withErrorHandler, requireAuth, parseBody, checkRateLimit, getIp,
} from "@/lib/apiHelpers";
import { RATE_LIMITS } from "@/lib/rateLimit";
import { MAX_LINES_PER_ORDER, MAX_QUANTITY_PER_ITEM } from "@/lib/storeRules";
import { StoreService, serializeOrder } from "@/services/StoreService";

const checkoutSchema = z.object({
  idempotencyKey: z.string().uuid("Chave de idempotência deve ser UUID."),
  items: z
    .array(
      z.object({
        productId: z.string().cuid(),
        quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM),
      })
    )
    .min(1, "O carrinho está vazio.")
    .max(MAX_LINES_PER_ORDER),
  payment: z.discriminatedUnion("method", [
    z.object({ method: z.literal("ACCOUNT") }),
    z.object({ method: z.literal("CARD"), cardId: z.string().cuid() }),
  ]),
});

/** GET /api/store/orders — the user's order history, newest first */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);
  const orders = await new StoreService(prisma).listOrders(userId);
  return ok(orders.map(serializeOrder));
});

/** POST /api/store/orders — pay for a cart with the account balance or a credit card */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);
  checkRateLimit(request, `store-checkout:${userId}`, RATE_LIMITS.checkout);

  const input = await parseBody(request, checkoutSchema);

  const { order, idempotent } = await new StoreService(prisma).checkout({
    userId,
    ...input,
    ipAddress: getIp(request),
    userAgent: request.headers.get("user-agent") ?? undefined,
  });

  const body = { idempotent, order: serializeOrder(order) };
  return idempotent ? ok(body) : created(body);
});
