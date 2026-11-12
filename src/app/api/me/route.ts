import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ok, notFound, withErrorHandler, requireAuth } from "@/lib/apiHelpers";

/** GET /api/me — the signed-in user's id, name and role */
export const GET = withErrorHandler(async (request: NextRequest) => {
  const { userId } = requireAuth(request);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, fullName: true, role: true },
  });
  if (!user) return notFound("Usuário");
  return ok(user);
});
