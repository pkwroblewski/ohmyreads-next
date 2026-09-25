/**
 * Direct messages (Phase 2, Task 21, T6).
 *
 * A message may only go to an accepted friend, never to yourself; marking as
 * read touches only messages addressed to the caller; deleting is scoped to
 * the sender. The unread counter follows read_at in SQL (migration 076), so
 * the action never writes it.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";

const { revalidatePath, checkRateLimit } = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/utils/log", () => ({ logError: vi.fn() }));

let mock: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mock,
  getUser: () => mock.auth.getUser(),
}));

import { sendMessage, markMessagesAsRead } from "@/lib/actions/messages";

const ME = { id: "550e8400-e29b-41d4-a716-446655440000" };
const FRIEND = "550e8400-e29b-41d4-a716-446655440001";
const MESSAGE = "550e8400-e29b-41d4-a716-446655440002";

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase(ME);
  checkRateLimit.mockResolvedValue({ allowed: true });
});

describe("sendMessage", () => {
  it("refuses an anonymous caller", async () => {
    mock = createMockSupabase(null);
    expect(await sendMessage(FRIEND, "hi")).toEqual({
      success: false,
      error: "Not authenticated",
    });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("refuses a message to yourself before looking up any friendship", async () => {
    const result = await sendMessage(ME.id, "talking to myself");

    expect(result).toEqual({ success: false, error: "You cannot message yourself" });
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("inserts nothing when there is no accepted friendship", async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: { message: "no rows" } });

    const result = await sendMessage(FRIEND, "hello");

    expect(result).toEqual({ success: false, error: "You can only message friends" });
    expect(mock.from).toHaveBeenCalledWith("friend_requests");
    expect(mock.eq).toHaveBeenCalledWith("status", "accepted");
    expect(mock.or).toHaveBeenCalledWith(expect.stringContaining(`sender_id.eq.${ME.id},receiver_id.eq.${FRIEND}`));
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("stores a trimmed message between friends and returns its id", async () => {
    mock.single
      .mockResolvedValueOnce({ data: { id: "friendship-1" }, error: null })
      .mockResolvedValueOnce({ data: { id: MESSAGE }, error: null });

    const result = await sendMessage(FRIEND, "  hello there  ");

    expect(result).toEqual({ success: true, messageId: MESSAGE });
    expect(mock.from).toHaveBeenCalledWith("direct_messages");
    expect(mock.insert).toHaveBeenCalledWith({
      sender_id: ME.id,
      receiver_id: FRIEND,
      content: "hello there",
    });
  });

  it("rejects an empty or over-long body and a malformed recipient before any query", async () => {
    expect((await sendMessage(FRIEND, "   ")).success).toBe(false);
    expect((await sendMessage(FRIEND, "x".repeat(2001))).success).toBe(false);
    expect((await sendMessage("nope", "hello")).success).toBe(false);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it("is rate limited at 30 per minute", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    const result = await sendMessage(FRIEND, "hello");
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/too many/i);
    expect(checkRateLimit).toHaveBeenCalledWith(`message:${ME.id}`, 30, 60000);
  });
});

describe("markMessagesAsRead", () => {
  it("marks only unread messages FROM the friend TO the caller and leaves the counter to SQL", async () => {
    // `.update().eq().eq().is()` is awaited directly; the chain resolves to
    // itself (error undefined).
    const result = await markMessagesAsRead(FRIEND);

    expect(result).toEqual({ success: true });
    expect(mock.from).toHaveBeenCalledWith("direct_messages");
    expect(mock.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(mock.eq).toHaveBeenCalledWith("sender_id", FRIEND);
    expect(mock.eq).toHaveBeenCalledWith("receiver_id", ME.id);
    expect(mock.is).toHaveBeenCalledWith("read_at", null);
    // No recount-and-overwrite: it lost messages that arrived in between
    expect(mock.from).not.toHaveBeenCalledWith("profiles");
    expect(mock.select).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/");
  });

  it("refuses an anonymous caller and a malformed friend id", async () => {
    expect(await markMessagesAsRead("nope")).toMatchObject({ success: false });
    mock = createMockSupabase(null);
    expect(await markMessagesAsRead(FRIEND)).toEqual({ success: false, error: "Not authenticated" });
    expect(mock.update).not.toHaveBeenCalled();
  });
});
