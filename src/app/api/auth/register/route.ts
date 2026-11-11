import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AuthService } from "@/services/AuthService";
import {
  created, err, withErrorHandler, parseBody,
  checkRateLimit, getIp,
} from "@/lib/apiHelpers";
import { RATE_LIMITS } from "@/lib/rateLimit";

const schema = z.object({
  email:    z.string().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  fullName: z.string().min(3).max(80),
  taxId:    z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos numéricos."),
  phone:    z.string().optional(),
});

export const POST = withErrorHandler(async (request: NextRequest) => {
  checkRateLimit(request, `register:${getIp(request)}`, RATE_LIMITS.auth);

  const input = await parseBody(request, schema);
  const service = new AuthService(prisma);
  const { userId } = await service.register(input);

  return created({ userId, message: "Conta criada com sucesso." });
});
