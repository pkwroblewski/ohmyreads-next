/**
 * Thrown from inside an `unstable_cache` callback to hand a value back without
 * caching it: the cache stores only resolved results (and on a failed refresh
 * keeps serving the stale entry). Used when an AI call failed and the result
 * holds written fallbacks — caching those would pin them for the whole TTL.
 */
export class UncachedResult<T> extends Error {
  constructor(readonly value: T) {
    super("AI call failed; serving the fallback uncached");
  }
}

/** Wraps a cached function so a thrown `UncachedResult` becomes its return value. */
export function serveUncachedResult<A extends unknown[], T>(
  cached: (...args: A) => Promise<T>
): (...args: A) => Promise<T> {
  return async (...args) => {
    try {
      return await cached(...args);
    } catch (error) {
      if (error instanceof UncachedResult) return error.value as T;
      throw error;
    }
  };
}
