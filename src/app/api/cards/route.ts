import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { CardService } from "@/services/CardService";

import {
  ok, created, withErrorHandler, requireAuth, parseBody,
} from "@/lib/apiHelpers";

const createSchema = z.object({
  accountId:         z.string().cuid(),
  holderName:        z.string().min(3).max(26),
  network:           z.string().default("MASTERCARD"),
  type:              z.string().default("CREDIT"),
  creditLimitCents:  z.string().regex(/^\d+$/).transform((v) => BigInt(v)),
  color:             z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  theme:             z.enum(["dark", "light", "neon"]).optional(),
});

/** GET /api/cards — list all cards */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);
  const service = new CardService(prisma);
  const cards = await service.listCards(userId);

  const serialised = cards.map((c) => ({
    ...c,
    creditLimitCents: c.creditLimitCents.toString(),
    availableLimitCents: c.availableLimitCents.toString(),
  }));

  return ok(serialised);
});

/** POST /api/cards — create a new virtual card */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);
  const input = await parseBody(request, createSchema);
  const service = new CardService(prisma);

  const card = await service.createCard({ ...input, userId });

  return created({
    ...card,
    creditLimitCents: card.creditLimitCents.toString(),
    availableLimitCents: card.availableLimitCents.toString(),
  });
});
