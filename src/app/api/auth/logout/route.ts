import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/services/AuthService";
import { clearAuthCookies } from "@/lib/jwt";
import { ok, withErrorHandler, getAuthContext } from "@/lib/apiHelpers";

/** Logout must always clear the cookies, even when the access token already expired. */
export const POST = withErrorHandler(async (request: NextRequest) => {
  const auth = getAuthContext(request);
  if (auth) {
    await new AuthService(prisma).logout(auth.jti, auth.userId);
  }
  await clearAuthCookies();
  return ok({ message: "Sessão encerrada." });
});
