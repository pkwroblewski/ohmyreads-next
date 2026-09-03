// @vitest-environment node
/**
 * Account actions (Phase 2, Task 11): password change and account deletion.
 *
 * Deletion is irreversible, so the guards matter more than the happy path:
 * the typed username must match, the sign-in must be recent (the JWT `amr`
 * timestamp), and the audit row must be written before the auth user goes.
 * Password change must verify the current password on a separate client and
 * never touch the caller's session when that check fails.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  getUser,
  getClaims,
  updateUser,
  sessionSignOut,
  sessionFrom,
  adminFrom,
  storageRemove,
  deleteUser,
  probeSignIn,
  probeSignOut,
  createAuditLog,
  checkRateLimit,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  getClaims: vi.fn(),
  updateUser: vi.fn(),
  sessionSignOut: vi.fn(),
  sessionFrom: vi.fn(),
  adminFrom: vi.fn(),
  storageRemove: vi.fn(),
  deleteUser: vi.fn(),
  probeSignIn: vi.fn(),
  probeSignOut: vi.fn(),
  createAuditLog: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, getClaims, updateUser, signOut: sessionSignOut },
    from: sessionFrom,
  }),
  getUser: () => getUser(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { deleteUser } },
    from: adminFrom,
    storage: { from: () => ({ remove: storageRemove }) },
  }),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    auth: { signInWithPassword: probeSignIn, signOut: probeSignOut },
  }),
}));

vi.mock("@/lib/utils/audit-log", () => ({
  createAuditLog: (...args: unknown[]) => createAuditLog(...args),
}));

vi.mock("@/lib/utils/rate-limit", () => ({
  checkRateLimit: (...args: unknown[]) => checkRateLimit(...args),
}));

vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  reportError: () => "Something went wrong",
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { changePassword, deleteAccount } from "@/lib/actions/account";

const USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const EMAIL_USER = {
  id: USER_ID,
  email: "reader@example.com",
  identities: [{ provider: "email" }],
  app_metadata: { providers: ["email"] },
};
const GOOGLE_USER = {
  id: USER_ID,
  email: "reader@gmail.com",
  identities: [{ provider: "google" }],
  app_metadata: { providers: ["google"] },
};

const nowSeconds = () => Math.floor(Date.now() / 1000);

function claimsWithAuthAt(timestamp: number) {
  return { data: { claims: { amr: [{ method: "password", timestamp }] } }, error: null };
}

/** profiles.select("username").eq("id", …).maybeSingle() on the session client. */
function profileUsername(username: string | null) {
  sessionFrom.mockReturnValue({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: username ? { username } : null, error: null }),
      }),
    }),
  });
}

/** place_photos.select("storage_path").eq("user_id", …) on the admin client. */
function ownedPhotos(paths: string[]) {
  adminFrom.mockReturnValue({
    select: () => ({
      eq: async () => ({ data: paths.map((storage_path) => ({ storage_path })), error: null }),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
  getUser.mockResolvedValue({ data: { user: EMAIL_USER }, error: null });
  getClaims.mockResolvedValue(claimsWithAuthAt(nowSeconds() - 30));
  checkRateLimit.mockResolvedValue({ allowed: true });
  updateUser.mockResolvedValue({ data: {}, error: null });
  sessionSignOut.mockResolvedValue({ error: null });
  deleteUser.mockResolvedValue({ data: {}, error: null });
  probeSignIn.mockResolvedValue({ data: { session: { access_token: "t" } }, error: null });
  probeSignOut.mockResolvedValue({ error: null });
  storageRemove.mockResolvedValue({ data: [], error: null });
  createAuditLog.mockResolvedValue(undefined);
  profileUsername("ada");
  ownedPhotos([]);
});

describe("deleteAccount", () => {
  it("writes the audit row, then deletes the auth user, then clears the session", async () => {
    const result = await deleteAccount({ confirmation: "ada" });

    expect(result).toEqual({ success: true });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.delete_account",
        targetType: "user",
        targetId: USER_ID,
        userId: USER_ID,
        metadata: { username: "ada", providers: ["email"] },
      })
    );
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
    expect(sessionSignOut).toHaveBeenCalledWith({ scope: "local" });

    const auditOrder = createAuditLog.mock.invocationCallOrder[0];
    const deleteOrder = deleteUser.mock.invocationCallOrder[0];
    const signOutOrder = sessionSignOut.mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(deleteOrder);
    expect(deleteOrder).toBeLessThan(signOutOrder);
  });

  it("matches the username case-insensitively and ignores surrounding whitespace", async () => {
    const result = await deleteAccount({ confirmation: "  ADA " });

    expect(result).toEqual({ success: true });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("refuses a mismatched confirmation without touching the account", async () => {
    const result = await deleteAccount({ confirmation: "not-ada" });

    expect(result).toMatchObject({ success: false, code: "mismatch" });
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(sessionSignOut).not.toHaveBeenCalled();
  });

  it("refuses an empty confirmation", async () => {
    const result = await deleteAccount({ confirmation: "   " });

    expect(result).toMatchObject({ success: false, code: "mismatch" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses a stale sign-in (amr older than 10 minutes)", async () => {
    getClaims.mockResolvedValue(claimsWithAuthAt(nowSeconds() - 11 * 60));

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result).toMatchObject({ success: false, code: "stale_session" });
    expect(createAuditLog).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses when the token carries no authentication timestamp at all", async () => {
    getClaims.mockResolvedValue({ data: { claims: {} }, error: null });

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result).toMatchObject({ success: false, code: "stale_session" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("uses the most recent amr entry when there are several", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: {
          amr: [
            { method: "password", timestamp: nowSeconds() - 3 * 24 * 3600 },
            { method: "oauth", timestamp: nowSeconds() - 20 },
          ],
        },
      },
      error: null,
    });

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result).toEqual({ success: true });
  });

  it("refuses an anonymous caller", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result.success).toBe(false);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("refuses when the reader has no username to match against", async () => {
    profileUsername(null);

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result).toMatchObject({ success: false, code: "mismatch" });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("removes the reader's place photos from storage before deleting the user", async () => {
    ownedPhotos(["a/1.jpg", "a/2.jpg"]);

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result).toEqual({ success: true });
    expect(storageRemove).toHaveBeenCalledWith(["a/1.jpg", "a/2.jpg"]);
    expect(storageRemove.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUser.mock.invocationCallOrder[0]
    );
  });

  it("still deletes the account when storage cleanup fails", async () => {
    ownedPhotos(["a/1.jpg"]);
    storageRemove.mockResolvedValue({ data: null, error: { message: "bucket gone" } });

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result).toEqual({ success: true });
    expect(deleteUser).toHaveBeenCalledWith(USER_ID);
  });

  it("reports a failed deletion and keeps the session", async () => {
    deleteUser.mockResolvedValue({ data: null, error: { message: "boom" } });

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result.success).toBe(false);
    expect(sessionSignOut).not.toHaveBeenCalled();
  });

  it("is rate limited per user", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await deleteAccount({ confirmation: "ada" });

    expect(result.success).toBe(false);
    expect(checkRateLimit).toHaveBeenCalledWith(`delete-account:${USER_ID}`, 5, 600000);
    expect(deleteUser).not.toHaveBeenCalled();
  });
});

describe("changePassword", () => {
  it("verifies the current password on a throwaway client, then updates the session user", async () => {
    const result = await changePassword({
      currentPassword: "old-password",
      newPassword: "new-password-1",
    });

    expect(result).toEqual({ success: true });
    expect(probeSignIn).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "old-password",
    });
    expect(probeSignOut).toHaveBeenCalledWith({ scope: "local" });
    expect(updateUser).toHaveBeenCalledWith({ password: "new-password-1" });
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "auth.password_change", targetId: USER_ID })
    );
    expect(sessionSignOut).not.toHaveBeenCalled();
  });

  it("refuses a wrong current password without updating anything", async () => {
    probeSignIn.mockResolvedValue({
      data: { session: null },
      error: { message: "Invalid login credentials" },
    });

    const result = await changePassword({
      currentPassword: "wrong",
      newPassword: "new-password-1",
    });

    expect(result).toMatchObject({ success: false, code: "wrong_password" });
    expect(updateUser).not.toHaveBeenCalled();
    expect(createAuditLog).not.toHaveBeenCalled();
  });

  it("rejects a short new password before touching auth", async () => {
    const result = await changePassword({ currentPassword: "old-password", newPassword: "short" });

    expect(result.success).toBe(false);
    expect(probeSignIn).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("rejects reusing the current password", async () => {
    const result = await changePassword({ currentPassword: "same-pass-1", newPassword: "same-pass-1" });

    expect(result.success).toBe(false);
    expect(probeSignIn).not.toHaveBeenCalled();
  });

  it("tells a Google-only account there is no password to change", async () => {
    getUser.mockResolvedValue({ data: { user: GOOGLE_USER }, error: null });

    const result = await changePassword({
      currentPassword: "anything",
      newPassword: "new-password-1",
    });

    expect(result).toMatchObject({ success: false, code: "no_password" });
    expect(probeSignIn).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("refuses an anonymous caller", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await changePassword({
      currentPassword: "old-password",
      newPassword: "new-password-1",
    });

    expect(result.success).toBe(false);
    expect(probeSignIn).not.toHaveBeenCalled();
  });

  it("is rate limited per user", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });

    const result = await changePassword({
      currentPassword: "old-password",
      newPassword: "new-password-1",
    });

    expect(result.success).toBe(false);
    expect(checkRateLimit).toHaveBeenCalledWith(`password-change:${USER_ID}`, 5, 900000);
    expect(probeSignIn).not.toHaveBeenCalled();
  });
});
