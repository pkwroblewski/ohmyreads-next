/**
 * Shared Supabase test doubles (Phase 2, Task 21).
 *
 * Two shapes, because the code under test uses the client two ways:
 *
 * 1. `createMockSupabase(user)` — a FLAT chain: every query method is a
 *    `vi.fn().mockReturnThis()` on one object, `single()` / `maybeSingle()` /
 *    `rpc()` resolve `{ data: null, error: null }` until told otherwise, and
 *    `auth.getUser()` answers for `user`. A test scripts the row a call sees
 *    with `mock.single.mockResolvedValueOnce(...)` and asserts on
 *    `mock.from` / `mock.eq` / `mock.insert` directly. Awaiting a chain that
 *    ends in a filter (`.update(..).eq(..)`) yields the chain object itself,
 *    whose `error` is `undefined` — i.e. success — unless the test does
 *    `mock.eq.mockResolvedValueOnce({ error })`.
 *
 *    This is the builder the action tests hand-rolled per file before Task 21;
 *    behaviour is identical, it just lives in one place.
 *
 * 2. `thenableQuery(result)` — a PER-QUERY chain for code that awaits query
 *    builders directly or hands them to `Promise.all` (route handlers). Every
 *    method chains and records `[method, args]`; awaiting resolves `result`.
 *    Pair it with `tableRouter({ profiles: ..., books: ... })` to answer
 *    per table.
 */

import { vi } from "vitest";

export type MockUser = { id: string; email?: string } | null;

export function authResult(user: MockUser) {
  return user
    ? { data: { user }, error: null }
    : { data: { user: null }, error: { message: "Not authenticated" } };
}

export function createMockSupabase(user: MockUser) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    overrideTypes: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    auth: {
      getUser: vi.fn().mockResolvedValue(authResult(user)),
    },
  };
  return chain;
}

export type MockSupabase = ReturnType<typeof createMockSupabase>;

export type QueryCall = [method: string, args: unknown[]];

/**
 * A query builder where every method chains (and is recorded) and awaiting
 * resolves to `result`. `result` may be a function, evaluated at await time,
 * so a test can make the answer depend on the recorded calls.
 */
export function thenableQuery<T>(
  result: T | ((calls: QueryCall[]) => T),
  calls: QueryCall[] = []
): T & { calls: QueryCall[] } {
  const target = {
    calls,
    then: (resolve: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(typeof result === "function" ? (result as (c: QueryCall[]) => T)(calls) : result).then(
        resolve,
        reject
      ),
  };
  return new Proxy(target, {
    get(t, prop: string | symbol) {
      if (prop === "then") return t.then;
      if (prop === "calls") return t.calls;
      if (typeof prop === "symbol") return undefined;
      return (...args: unknown[]) => {
        calls.push([prop, args]);
        return thenableQuery(result, calls);
      };
    },
  }) as unknown as T & { calls: QueryCall[] };
}

/**
 * `from(table)` that answers from a per-table map of results (or result
 * factories). Unknown tables answer `{ data: null, error: null }`. Every
 * query's recorded calls are kept in `calls[table]` in order of creation.
 */
export function tableRouter(
  answers: Record<string, unknown | ((calls: QueryCall[]) => unknown)>
) {
  const calls: Record<string, QueryCall[][]> = {};
  const from = vi.fn((table: string) => {
    const recorded: QueryCall[] = [];
    (calls[table] ??= []).push(recorded);
    const answer = table in answers ? answers[table] : { data: null, error: null };
    return thenableQuery(answer, recorded);
  });
  return { from, calls };
}
