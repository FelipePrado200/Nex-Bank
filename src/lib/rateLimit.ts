/**
 * rateLimit.ts
 * In-memory sliding-window rate limiter for API routes.
 * For production, replace the in-memory store with Redis.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

// In-memory store — keyed by identifier (IP or userId)
const store = new Map<string, WindowEntry>();

export interface RateLimitOptions {
  /** Max requests per window */
  limit: number;
  /** Window size in seconds */
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Check and increment the rate limit for a given identifier.
 * Call this at the top of sensitive API handlers.
 */
export function rateLimit(
  identifier: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;

  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    // New window
    const newEntry: WindowEntry = {
      count: 1,
      resetAt: now + windowMs,
    };
    store.set(identifier, newEntry);

    return {
      allowed: true,
      remaining: options.limit - 1,
      resetAt: newEntry.resetAt,
    };
  }

  if (entry.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  entry.count += 1;

  return {
    allowed: true,
    remaining: options.limit - entry.count,
    resetAt: entry.resetAt,
  };
}

// Preset configurations
export const RATE_LIMITS = {
  /** Auth endpoints — strict */
  auth: { limit: 5, windowSeconds: 60 },
  /** CVV reveal — very strict, audit-logged */
  cvvReveal: { limit: 3, windowSeconds: 300 },
  /** General API calls */
  api: { limit: 100, windowSeconds: 60 },
  /** Transfer endpoint */
  transfer: { limit: 20, windowSeconds: 60 },
  /** Store checkout */
  checkout: { limit: 10, windowSeconds: 60 },
} satisfies Record<string, RateLimitOptions>;
