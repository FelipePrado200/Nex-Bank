/**
 * env.ts — validate environment variables at startup with Zod.
 *
 * Import this file at the top of any server entry that needs the env.
 * A missing or malformed variable throws immediately with a clear message
 * instead of surfacing as a runtime error deep inside a request handler.
 */

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET must be at least 32 characters"),

  ENCRYPTION_KEY: z
    .string()
    .min(32, "ENCRYPTION_KEY must be at least 32 characters"),

  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  /** Optional */
  JWT_EXPIRY:            z.string().optional(),
  REFRESH_TOKEN_EXPIRY:  z.string().optional(),
  CRON_SECRET:           z.string().optional(),
  NEXT_PUBLIC_APP_URL:   z.string().url().optional(),
});

function parseEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return result.data;
}

export const env = parseEnv();
export type Env = typeof env;
