/**
 * jwt.ts
 * JWT utilities using `jose` — HttpOnly cookie strategy.
 *
 * Access token:  short-lived (15 min), stored in HttpOnly Secure cookie.
 * Refresh token: long-lived (7 days), stored in a separate HttpOnly cookie.
 * Both are SameSite=Strict to prevent CSRF.
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

// ─────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────

const ACCESS_COOKIE  = "nx_access";
const REFRESH_COOKIE = "nx_refresh";

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

// ─────────────────────────────────────────────
// Payload shape
// ─────────────────────────────────────────────

export interface AccessTokenPayload extends JWTPayload {
  sub: string;      // userId
  jti: string;      // unique token ID (for revocation)
  email: string;
}

export interface RefreshTokenPayload extends JWTPayload {
  sub: string;
  jti: string;
  sessionId: string;
}

// ─────────────────────────────────────────────
// Sign
// ─────────────────────────────────────────────

export async function signAccessToken(
  payload: Omit<AccessTokenPayload, "iat" | "exp" | "iss">
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRY ?? "15m")
    .setIssuer("nexbank")
    .sign(getSecret());
}

export async function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "iat" | "exp" | "iss">
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.REFRESH_TOKEN_EXPIRY ?? "7d")
    .setIssuer("nexbank")
    .sign(getSecret());
}

// ─────────────────────────────────────────────
// Verify
// ─────────────────────────────────────────────

export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: "nexbank",
  });
  return payload as AccessTokenPayload;
}

export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, getSecret(), {
    issuer: "nexbank",
  });
  return payload as RefreshTokenPayload;
}

// ─────────────────────────────────────────────
// Cookie helpers (server-side, Next.js App Router)
// ─────────────────────────────────────────────

const IS_PROD = process.env.NODE_ENV === "production";

/** Set both access and refresh cookies after login. */
export async function setAuthCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const jar = await cookies();

  jar.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/",
    maxAge: 15 * 60, // 15 minutes
  });

  jar.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: "strict",
    path: "/api/auth/refresh", // restrict to refresh endpoint only
    maxAge: 7 * 24 * 60 * 60, // 7 days
  });
}

/** Clear auth cookies on logout. */
export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  // The refresh cookie is scoped to its own path, so it must be deleted with that path.
  jar.delete({ name: REFRESH_COOKIE, path: "/api/auth/refresh" });
}

/** Extract and verify access token from an incoming request. */
export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AccessTokenPayload | null> {
  const token = request.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}

/** Extract the raw refresh token from cookies. */
export function getRefreshToken(request: NextRequest): string | null {
  return request.cookies.get(REFRESH_COOKIE)?.value ?? null;
}
