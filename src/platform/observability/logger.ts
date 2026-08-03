import { randomUUID } from "crypto";

import { getServerEnv } from "@/platform/config/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

export type Logger = {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  child(context: LogContext): Logger;
};

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function shouldLog(level: LogLevel): boolean {
  const configured = getServerEnv().LOG_LEVEL;
  return LEVEL_ORDER[level] >= LEVEL_ORDER[configured];
}

function write(level: LogLevel, message: string, context: LogContext = {}): void {
  if (!shouldLog(level)) return;

  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    service: getServerEnv().OTEL_SERVICE_NAME,
    ...context,
  };

  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function createLogger(baseContext: LogContext = {}): Logger {
  return {
    debug: (message, context) => write("debug", message, { ...baseContext, ...context }),
    info: (message, context) => write("info", message, { ...baseContext, ...context }),
    warn: (message, context) => write("warn", message, { ...baseContext, ...context }),
    error: (message, context) => write("error", message, { ...baseContext, ...context }),
    child: (context) => createLogger({ ...baseContext, ...context }),
  };
}

export const platformLogger = createLogger({ component: "platform" });

export function createRequestId(): string {
  return randomUUID();
}
