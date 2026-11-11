import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/services/AuthService";
import { setAuthCookies } from "@/lib/jwt";
import {
  ok, withErrorHandler, parseBody, checkRateLimit, getIp,
} from "@/lib/apiHelpers";
import { RATE_LIMITS } from "@/lib/rateLimit";

const schema = z.object({
  email:    z.string().email(),
  password: z.string().min(1),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  const ip = getIp(request);
  checkRateLimit(request, `login:${ip}`, RATE_LIMITS.auth);

  const { email, password } = await parseBody(request, schema);
  const service = new AuthService(prisma);

  const tokens = await service.login(
    email,
    password,
    ip,
    request.headers.get("user-agent") ?? undefined
  );

  await setAuthCookies(tokens.accessToken, tokens.refreshToken);

  return ok({ message: "Login realizado com sucesso." });
});
