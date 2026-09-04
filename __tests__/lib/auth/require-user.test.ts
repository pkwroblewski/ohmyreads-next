/**
 * Tests for the canonical "who is calling?" gate (Phase 2, Task 22).
 *
 * Every Server Action now opens with `requireUser()`, so these cases stand in
 * for the 80-odd auth preambles it replaced: an anonymous caller is refused
 * with the one message the tests and UI agree on, a signed-in caller gets the
 * session client and user back, and `withProfile` reads the caller's own row
 * through the owner RPC (the private columns are not selectable since 065).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const rpc = vi.fn();
const client = { rpc };

vi.mock("@/lib/supabase/server", () => ({
  getUser: () => getUser(),
  createClient: async () => client,
}));

const logError = vi.fn();
vi.mock("@/lib/utils/log", () => ({
  logError: (...args: unknown[]) => logError(...args),
}));

import { requireUser } from "@/lib/auth/require-user";

const ME = { id: "550e8400-e29b-41d4-a716-446655440000" };

function signedInAs(user: { id: string } | null) {
  getUser.mockResolvedValue({ data: { user } });
}

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) });
});

describe("requireUser", () => {
  it("refuses an anonymous caller with the shared message and no client", async () => {
    signedInAs(null);

    expect(await requireUser()).toEqual({ ok: false, error: "Not authenticated" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hands a signed-in caller the session client and the user", async () => {
    signedInAs(ME);

    const result = await requireUser();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");
    expect(result.user).toEqual(ME);
    expect(result.supabase).toBe(client);
    expect(result.profile).toBeUndefined();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("reads the caller's own row through get_my_profile when asked", async () => {
    signedInAs(ME);
    const profile = { id: ME.id, username: "me", location_geohash: "u4pruy" };
    rpc.mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: null }) });

    const result = await requireUser({ withProfile: true });

    expect(rpc).toHaveBeenCalledWith("get_my_profile");
    expect(result.ok && result.profile).toEqual(profile);
    expect(logError).not.toHaveBeenCalled();
  });

  it("stays ok with a null profile, and logs, when the RPC fails", async () => {
    signedInAs(ME);
    rpc.mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } }),
    });

    const result = await requireUser({ withProfile: true });

    expect(result.ok).toBe(true);
    expect(result.ok && result.profile).toBeNull();
    expect(logError).toHaveBeenCalledWith(
      "requireUser: get_my_profile failed",
      { message: "boom" },
      { userId: ME.id }
    );
  });
});
