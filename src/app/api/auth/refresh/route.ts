import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/services/AuthService";
import { getRefreshToken, setAuthCookies } from "@/lib/jwt";
import { ok, err, withErrorHandler, getIp } from "@/lib/apiHelpers";

export const POST = withErrorHandler(async (request: NextRequest) => {
  const rawRefreshToken = getRefreshToken(request);
  if (!rawRefreshToken) return err("Refresh token ausente.", 401);

  const service = new AuthService(prisma);
  const tokens = await service.refresh(rawRefreshToken, getIp(request));
  await setAuthCookies(tokens.accessToken, tokens.refreshToken);

  return ok({ message: "Token renovado." });
});
