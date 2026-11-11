import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, withErrorHandler, requireAuth } from "@/lib/apiHelpers";

/** GET /api/accounts/lookup?number=... — find an account by number (used by the transfer form) */
export const GET = withErrorHandler(async (request: NextRequest) => {
  requireAuth(request);
  const number = request.nextUrl.searchParams.get("number")?.trim() ?? "";
  if (!number) return notFound("Conta");

  const account = await prisma.account.findFirst({
    where: { number, isActive: true },
    select: {
      id: true,
      number: true,
      agency: true,
      user: { select: { fullName: true } },
    },
  });

  if (!account) return notFound("Conta");

  return ok({
    id: account.id,
    number: account.number,
    agency: account.agency,
    holderName: account.user.fullName,
  });
});
