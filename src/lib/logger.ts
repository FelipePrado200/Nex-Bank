/**
 * logger.ts — lightweight structured logger for Next.js server code.
 *
 * Outputs JSON lines in production (for log aggregators like Datadog / Loki)
 * and readable colourised text in development via console.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ userId, action: "LOGIN" }, "User authenticated");
 *   logger.error({ err, endpoint: "/api/transfers" }, "Transfer failed");
 */

type Level = "debug" | "info" | "warn" | "error";

interface LogFields {
  [key: string]: unknown;
  err?: unknown;
}

const LEVEL_NUM: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: Level = process.env.LOG_LEVEL as Level ?? "info";

function serialiseError(err: unknown): object | undefined {
  if (!err) return undefined;
  if (err instanceof Error) {
    return { message: err.message, name: err.name, stack: err.stack };
  }
  return { raw: String(err) };
}

function log(level: Level, fields: LogFields, message: string) {
  if (LEVEL_NUM[level] < LEVEL_NUM[MIN_LEVEL]) return;

  const { err, ...rest } = fields;
  const entry = {
    level,
    time: new Date().toISOString(),
    msg: message,
    ...(err ? { err: serialiseError(err) } : {}),
    ...rest,
  };

  if (process.env.NODE_ENV === "production") {
    // JSON lines — parsed by any log aggregator
    process.stdout.write(JSON.stringify(entry) + "\n");
  } else {
    // Human-readable in development
    const colour: Record<Level, string> = {
      debug: "\x1b[37m",
      info:  "\x1b[36m",
      warn:  "\x1b[33m",
      error: "\x1b[31m",
    };
    const reset = "\x1b[0m";
    const prefix = `${colour[level]}[${level.toUpperCase()}]${reset}`;
    const extras = Object.keys(rest).length ? " " + JSON.stringify(rest) : "";
    const errLine = err instanceof Error ? `\n  ${err.stack}` : "";
    console.log(`${prefix} ${message}${extras}${errLine}`);
  }
}

export const logger = {
  debug: (fields: LogFields, msg: string) => log("debug", fields, msg),
  info:  (fields: LogFields, msg: string) => log("info",  fields, msg),
  warn:  (fields: LogFields, msg: string) => log("warn",  fields, msg),
  error: (fields: LogFields, msg: string) => log("error", fields, msg),
};
