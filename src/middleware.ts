/**
 * middleware.ts
 * Next.js Edge middleware — JWT auth guard for protected routes.
 *
 * Protected paths: /dashboard/*, /api/accounts/*, /api/transfers/*,
 *                  /api/cards/*, /api/loans/*, /api/invoices/*
 * Public paths:    /api/auth/*, /  (landing), /login, /register
 */

import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const ACCESS_COOKIE = "nx_access";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? "";
  return new TextEncoder().encode(secret);
}

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/api/accounts",
  "/api/transfers",
  "/api/cards",
  "/api/loans",
  "/api/invoices",
  "/api/store",
  "/api/me",
  "/api/admin",
  "/admin",
];

const PUBLIC_PREFIXES = [
  "/api/auth",
  "/api/health",
  "/api/cron",   // secured by CRON_SECRET header, not JWT
];

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Logout is public (it must work with an expired token) but still identifies the user when it can.
  if (pathname === "/api/auth/logout") return identifyIfPossible(request);

  // Skip public paths
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  // Check if path needs protection
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Extract token
  const token = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!token) {
    return redirectOrUnauthorized(request, pathname);
  }

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: "nexbank",
    });

    // Forward user info to route handlers via request headers
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.sub ?? "");
    requestHeaders.set("x-user-email", (payload as { email?: string }).email ?? "");
    requestHeaders.set("x-user-jti", (payload.jti as string) ?? "");

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return redirectOrUnauthorized(request, pathname);
  }
}

async function identifyIfPossible(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return NextResponse.next();
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: "nexbank" });
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", payload.sub ?? "");
    requestHeaders.set("x-user-email", (payload as { email?: string }).email ?? "");
    requestHeaders.set("x-user-jti", (payload.jti as string) ?? "");
    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch {
    return NextResponse.next();
  }
}

function redirectOrUnauthorized(request: NextRequest, pathname: string) {
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Não autenticado." },
      { status: 401 }
    );
  }
  // Redirect browser requests to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

// ─────────────────────────────────────────────
// Matcher — apply middleware only to relevant paths
// ─────────────────────────────────────────────

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
    "/api/accounts/:path*",
    "/api/transfers/:path*",
    "/api/cards/:path*",
    "/api/loans/:path*",
    "/api/invoices/:path*",
    "/api/store/:path*",
    "/api/me",
    "/api/admin/:path*",
    "/api/auth/logout",
    "/api/auth/refresh",
  ],
};
