// @vitest-environment node
/**
 * Email preferences (Phase 2, Task 9): the settings-side opt-out.
 *
 * The write must be the caller's own row (`eq("id", user.id)`) through the
 * session client — 065 left UPDATE on the email columns to the owner policy —
 * and, like every write since Task 6, a zero-row result is a failure.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const getUser = vi.fn();
const rpcMaybeSingle = vi.fn();
const update = vi.fn();
const eq = vi.fn();
const select = vi.fn();
const from = vi.fn();
const checkRateLimit = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from,
    rpc: () => ({ maybeSingle: rpcMaybeSingle }),
  }),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { getEmailPreferences, updateEmailPreferences } from "@/lib/actions/privacy";

const USER = { id: "550e8400-e29b-41d4-a716-446655440000" };

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: USER }, error: null });
  checkRateLimit.mockResolvedValue({ allowed: true });
  select.mockResolvedValue({ data: [{ id: USER.id }], error: null });
  eq.mockReturnValue({ select });
  update.mockReturnValue({ eq });
  from.mockReturnValue({ update });
});

describe("updateEmailPreferences", () => {
  it("writes the caller's own row through the session client", async () => {
    const result = await updateEmailPreferences({ digestEnabled: false });

    expect(result).toEqual({ success: true });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({ email_digest_enabled: false });
    expect(eq).toHaveBeenCalledWith("id", USER.id);
  });

  it("refuses an anonymous caller without writing", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await updateEmailPreferences({ digestEnabled: false });

    expect(result).toEqual({ success: false, error: "Not authenticated" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects an empty or malformed update before writing", async () => {
    expect((await updateEmailPreferences({})).success).toBe(false);
    expect(
      (await updateEmailPreferences({ digestEnabled: "yes" as unknown as boolean })).success
    ).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("fails when the update touched no row", async () => {
    select.mockResolvedValue({ data: [], error: null });

    const result = await updateEmailPreferences({ digestEnabled: true });

    expect(result).toEqual({ success: false, error: "Nothing was changed" });
  });

  it("stops at the shared privacy rate limit", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await updateEmailPreferences({ digestEnabled: false });

    expect(result.success).toBe(false);
    expect(checkRateLimit).toHaveBeenCalledWith(`privacy:${USER.id}`, 10, 60000);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("getEmailPreferences", () => {
  it("reads the flag through the owner RPC", async () => {
    rpcMaybeSingle.mockResolvedValue({ data: { email_digest_enabled: false }, error: null });

    expect(await getEmailPreferences()).toEqual({ digestEnabled: false });
  });

  it("falls back to the column default when there is no row", async () => {
    rpcMaybeSingle.mockResolvedValue({ data: null, error: null });

    expect(await getEmailPreferences()).toEqual({ digestEnabled: true });
  });
});
