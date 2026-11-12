/**
 * apiHelpers.ts
 * Shared utilities for Next.js App Router route handlers.
 */

import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { DomainError } from "./errors";
import { rateLimit, type RateLimitOptions } from "./rateLimit";
import { logger } from "./logger";

// ─────────────────────────────────────────────
// Standard API response shapes
// ─────────────────────────────────────────────

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status });
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json({ ok: true, data }, { status: 201 });
}

export function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export function unauthorized(): NextResponse {
  return err("Não autenticado.", 401);
}

export function forbidden(): NextResponse {
  return err("Acesso negado.", 403);
}

export function notFound(entity = "Recurso"): NextResponse {
  return err(`${entity} não encontrado.`, 404);
}

// ─────────────────────────────────────────────
// Extract authenticated user from headers
// (set by middleware after JWT verification)
// ─────────────────────────────────────────────

export interface AuthContext {
  userId: string;
  email: string;
  jti: string;
}

export function getAuthContext(request: NextRequest): AuthContext | null {
  const userId = request.headers.get("x-user-id");
  const email = request.headers.get("x-user-email");
  const jti = request.headers.get("x-user-jti");

  if (!userId || !email || !jti) return null;
  return { userId, email, jti };
}

export function requireAuth(request: NextRequest): AuthContext {
  const ctx = getAuthContext(request);
  if (!ctx) throw new UnauthorizedError();
  return ctx;
}

// ─────────────────────────────────────────────
// Zod parse helper
// ─────────────────────────────────────────────

export async function parseBody<S extends ZodSchema>(
  request: NextRequest,
  schema: S
): Promise<S["_output"]> {
  const body = await request.json().catch(() => null);
  return schema.parse(body);
}

// ─────────────────────────────────────────────
// Rate limit helper
// ─────────────────────────────────────────────

export function checkRateLimit(
  request: NextRequest,
  identifier: string,
  options: RateLimitOptions
): void {
  const result = rateLimit(identifier, options);
  if (!result.allowed) {
    throw new RateLimitError(result.resetAt);
  }
}

// ─────────────────────────────────────────────
// IP extraction
// ─────────────────────────────────────────────

export function getIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ─────────────────────────────────────────────
// Error classes
// ─────────────────────────────────────────────

export class UnauthorizedError extends Error {
  constructor() {
    super("Não autenticado.");
    this.name = "UnauthorizedError";
  }
}

export class RateLimitError extends Error {
  constructor(public readonly resetAt: number) {
    super("Muitas requisições. Tente novamente mais tarde.");
    this.name = "RateLimitError";
  }
}

// ─────────────────────────────────────────────
// Global error handler wrapper
// ─────────────────────────────────────────────

/** What the route handlers see: params already resolved. */
type RouteHandler = (
  request: NextRequest,
  context?: { params: Record<string, string> }
) => Promise<NextResponse>;

/** What Next.js 15 passes in: params is a Promise. */
type NextRouteContext = { params: Promise<Record<string, string>> };

export function withErrorHandler(handler: RouteHandler) {
  // `nextContext` must not be optional: Next's generated route types reject `T | undefined`.
  return async (request: NextRequest, nextContext: NextRouteContext): Promise<NextResponse> => {
    try {
      const params = nextContext ? await nextContext.params : {};
      return await handler(request, { params });
    } catch (error) {
      if (error instanceof UnauthorizedError) return unauthorized();
      if (error instanceof DomainError) return err(error.message, error.status);
      if (error instanceof RateLimitError) {
        return NextResponse.json(
          { ok: false, error: error.message },
          {
            status: 429,
            headers: {
              "Retry-After": String(Math.ceil((error.resetAt - Date.now()) / 1000)),
            },
          }
        );
      }
      if (error instanceof ZodError) {
        return err(
          error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
          422
        );
      }
      if (error instanceof Error) {
        // Known domain errors — return 400
        const knownErrors = [
          "Saldo insuficiente",
          "Conta não encontrada",
          "Cartão não",
          "Limite insuficiente",
          "Credenciais",
          "E-mail já",
          "Sessão inválida",
          "Token inválido",
          "Esta parcela",
          "O prazo",
          "O valor",
          "O depósito",
        ];
        const isKnown = knownErrors.some((prefix) =>
          error.message.startsWith(prefix)
        );
        if (isKnown) return err(error.message, 400);

        logger.error({ err: error }, "[API Error]");
        return err("Erro interno. Tente novamente.", 500);
      }

      logger.error({ err: error }, "[Unexpected Error]");
      return err("Erro interno.", 500);
    }
  };
}
