/**
 * Centralized logging utility
 * Provides structured logging with different levels
 * In production, this could be extended to send logs to external services
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
}

/**
 * Internal logging function
 */
function log(level: LogLevel, message: string, context?: LogContext): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
  };

  // In development, use colored console output
  if (process.env.NODE_ENV === "development") {
    const colors = {
      info: "\x1b[36m", // cyan
      warn: "\x1b[33m", // yellow
      error: "\x1b[31m", // red
      debug: "\x1b[90m", // gray
    };
    const reset = "\x1b[0m";
    const color = colors[level];

    const fn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : level === "debug"
            ? console.debug
            : console.log;

    fn(
      `${color}[${entry.timestamp}] ${level.toUpperCase()}:${reset} ${message}`,
      context ? context : ""
    );
    return;
  }

  // In production, output structured JSON for log aggregators
  // Exclude debug logs in production unless explicitly enabled
  if (level === "debug" && !process.env.DEBUG_LOGS) {
    return;
  }

  console.log(JSON.stringify(entry));
}

/**
 * Logger object with methods for each log level
 *
 * @example
 * ```ts
 * import { logger } from '@/lib/utils/log';
 *
 * logger.info('User signed up', { userId: user.id });
 * logger.error('Failed to create review', { error, bookId });
 * logger.warn('Rate limit approaching', { userId, remaining: 2 });
 * logger.debug('Query executed', { query, duration: 150 });
 * ```
 */
export const logger = {
  /**
   * Log informational messages - general operational information
   */
  info: (message: string, context?: LogContext) => log("info", message, context),

  /**
   * Log warnings - potential issues that aren't errors
   */
  warn: (message: string, context?: LogContext) => log("warn", message, context),

  /**
   * Log errors - failures that need attention
   */
  error: (message: string, context?: LogContext) =>
    log("error", message, context),

  /**
   * Log debug messages - detailed info for debugging (disabled in production by default)
   */
  debug: (message: string, context?: LogContext) =>
    log("debug", message, context),
};

/**
 * Helper to safely extract error information for logging
 */
export function extractErrorInfo(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack:
        process.env.NODE_ENV === "development" ? error.stack : undefined,
    };
  }

  if (typeof error === "string") {
    return { errorMessage: error };
  }

  return { errorMessage: String(error) };
}

