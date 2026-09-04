/**
 * updateProfile (Phase 2, Task 21, T8).
 *
 * A username is refused when another account holds it, and the check must
 * exclude the caller's own row so keeping your username is not a conflict.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";

const { revalidatePath, checkRateLimit } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  reportError: (msg: string) => msg,
}));

let mock: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mock,
  getUser: () => mock.auth.getUser(),
}));

import { updateProfile } from "@/lib/actions/user";

const ME = { id: "550e8400-e29b-41d4-a716-446655440000" };

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase(ME);
  checkRateLimit.mockResolvedValue({ allowed: true });
});

describe("updateProfile", () => {
  it("refuses an anonymous caller and stops at the rate limit", async () => {
    mock = createMockSupabase(null);
    expect(await updateProfile({ bio: "hi" })).toEqual({ success: false, error: "Not authenticated" });

    mock = createMockSupabase(ME);
    checkRateLimit.mockResolvedValue({ allowed: false });
    expect((await updateProfile({ bio: "hi" })).error).toMatch(/too many/i);
    expect(checkRateLimit).toHaveBeenCalledWith(`profile:${ME.id}`, 20, 60000);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("refuses a username held by a different account, checking everyone but the caller", async () => {
    mock.single.mockResolvedValueOnce({ data: { id: "someone-else" }, error: null });

    const result = await updateProfile({ username: "ada" });

    expect(result).toEqual({ success: false, error: "Username is already taken" });
    expect(mock.from).toHaveBeenCalledWith("profiles");
    expect(mock.eq).toHaveBeenCalledWith("username", "ada");
    expect(mock.neq).toHaveBeenCalledWith("id", ME.id);
    expect(mock.update).not.toHaveBeenCalled();
  });

  it("writes the mapped columns, nulls cleared fields and revalidates the new profile URL", async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: null }); // username free

    const result = await updateProfile({
      username: "ada_l",
      displayName: "",
      bio: "Reader",
      website: "https://ada.example",
    });

    expect(result).toEqual({ success: true });
    expect(mock.update).toHaveBeenCalledWith({
      updated_at: expect.any(String),
      username: "ada_l",
      display_name: null,
      bio: "Reader",
      website: "https://ada.example",
    });
    expect(mock.eq).toHaveBeenLastCalledWith("id", ME.id);
    expect(revalidatePath).toHaveBeenCalledWith("/profile");
    expect(revalidatePath).toHaveBeenCalledWith("/settings");
    expect(revalidatePath).toHaveBeenCalledWith("/users/ada_l");
  });

  it("skips the username lookup when no username is sent", async () => {
    expect(await updateProfile({ bio: "just a bio" })).toEqual({ success: true });
    expect(mock.select).not.toHaveBeenCalled();
    expect(mock.update).toHaveBeenCalledWith({ updated_at: expect.any(String), bio: "just a bio" });
    expect(revalidatePath).not.toHaveBeenCalledWith(expect.stringMatching(/^\/users\//));
  });

  it("rejects an invalid username, a javascript: website and an over-long bio before any query", async () => {
    expect((await updateProfile({ username: "Ada Lovelace" })).error).toMatch(/lowercase/i);
    expect((await updateProfile({ username: "ab" })).error).toMatch(/at least 3/i);
    expect((await updateProfile({ website: "javascript:alert(1)" })).error).toBeTruthy();
    expect((await updateProfile({ bio: "x".repeat(501) })).error).toMatch(/500/);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("surfaces a database error without revalidating", async () => {
    mock.eq
      .mockReturnValueOnce(mock)
      .mockResolvedValueOnce({ error: { message: "boom" } });
    // no username → first eq is the update's
    mock.eq.mockReset();
    mock.eq.mockResolvedValueOnce({ error: { message: "boom" } });

    expect(await updateProfile({ bio: "hi" })).toEqual({ success: false, error: "Error updating profile" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
