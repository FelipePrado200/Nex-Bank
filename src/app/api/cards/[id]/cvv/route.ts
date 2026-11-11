import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { CardService } from "@/services/CardService";
import {
  ok, withErrorHandler, requireAuth, checkRateLimit, getIp,
} from "@/lib/apiHelpers";
import { RATE_LIMITS } from "@/lib/rateLimit";

/** POST /api/cards/[id]/cvv — reveal CVV (audit-logged, rate-limited) */
export const POST = withErrorHandler(async (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => {
  const { userId } = requireAuth(request);
  const cardId = context?.params.id ?? "";

  // Very strict rate limit: 3 reveals per 5 minutes per user
  checkRateLimit(request, `cvv:${userId}`, RATE_LIMITS.cvvReveal);

  const service = new CardService(prisma);
  const cvv = await service.revealCvv(
    cardId,
    userId,
    getIp(request),
    request.headers.get("user-agent") ?? undefined
  );

  return ok({ cvv });
});
