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

/**
 * Supabase error structure
 */
interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Helper to safely extract Supabase/PostgreSQL error information for logging
 * Only includes safe fields (code, message) without internal details (SQL, paths)
 */
export function extractSupabaseErrorInfo(
  error: SupabaseError | null | undefined
): LogContext {
  if (!error) {
    return { errorMessage: "Unknown error" };
  }

  const info: LogContext = {};

  // Always include error code (e.g., "23505" for unique violation)
  if (error.code) {
    info.errorCode = error.code;
  }

  // Include message but strip any potential SQL fragments
  if (error.message) {
    // Sanitize: remove anything that looks like SQL or file paths
    info.errorMessage = error.message
      .replace(/\/[^\s]+/g, "[path]") // Remove file paths
      .replace(/SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|JOIN/gi, "[sql]"); // Mask SQL keywords
  }

  // Only include hint/details in development (may contain internal info)
  if (process.env.NODE_ENV === "development") {
    if (error.details) info.errorDetails = error.details;
    if (error.hint) info.errorHint = error.hint;
  }

  return info;
}


/**
 * Picks the right extractor for a thrown value.
 *
 * Supabase/PostgREST errors are plain objects, not `Error` instances, and carry
 * the fields `extractSupabaseErrorInfo` knows how to strip.
 */
function describeError(error: unknown): LogContext {
  return error !== null &&
    typeof error === "object" &&
    !(error instanceof Error)
    ? extractSupabaseErrorInfo(error as SupabaseError)
    : extractErrorInfo(error);
}

/**
 * Log an error with structured, scrubbed context. Use this in place of
 * `console.error("Something failed:", error)`.
 *
 * This is the log-only counterpart to {@link reportError}: reach for that one
 * when the call site also needs a client-safe string to return, and this one
 * when it already has its own copy or returns nothing.
 *
 * @example
 * ```ts
 * } catch (error) {
 *   logError("Error in getUserShelves", error, { userId });
 *   return { shelves: [], error: "An unexpected error occurred" };
 * }
 * ```
 */
export function logError(
  message: string,
  error: unknown,
  context?: LogContext
): void {
  const info = describeError(error);
  logger.error(message, context ? { ...info, ...context } : info);
}

/**
 * Stable, client-safe error copy.
 *
 * Raw Postgres/PostgREST messages must never reach the browser — they leak
 * constraint, column, policy and function names that map out the schema.
 */
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Logs an error server-side (structured + sanitized) and returns a message that
 * is safe to hand back to the client.
 *
 * Use this instead of `return { error: error.message }`. Where a call site has
 * more useful copy of its own, call this for the log and return that copy.
 *
 * @example
 * ```ts
 * if (error) {
 *   return { error: reportError("Error creating shelf", error, { userId }) };
 * }
 * ```
 */
export function reportError(
  message: string,
  error: unknown,
  context?: LogContext
): string {
  logError(message, error, context);

  return GENERIC_ERROR_MESSAGE;
}
