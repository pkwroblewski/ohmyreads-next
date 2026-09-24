/**
 * Friend requests (full audit, Task 10).
 *
 * sendFriendRequest returns the new row's id so the button can cancel it
 * straight away, and a rejected pair can start over: the one-row-per-pair
 * index means the rejected row is deleted before the new insert.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase, type MockSupabase } from "../../helpers/mock-supabase";

const { checkRateLimit } = vi.hoisted(() => ({ checkRateLimit: vi.fn() }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/utils/rate-limit", () => ({ checkRateLimit }));
vi.mock("@/lib/utils/log", () => ({
  logError: vi.fn(),
  reportError: () => "Something went wrong",
}));

let mock: MockSupabase;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => mock,
  getUser: () => mock.auth.getUser(),
}));

import { sendFriendRequest } from "@/lib/actions/friends";

const ME = { id: "550e8400-e29b-41d4-a716-446655440000" };
const THEM = "550e8400-e29b-41d4-a716-446655440001";
const OLD_REQUEST = "550e8400-e29b-41d4-a716-446655440002";
const NEW_REQUEST = "550e8400-e29b-41d4-a716-446655440003";

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase(ME);
  checkRateLimit.mockResolvedValue({ allowed: true });
});

describe("sendFriendRequest", () => {
  it("returns the new request id", async () => {
    mock.single
      .mockResolvedValueOnce({ data: null, error: null }) // no existing row
      .mockResolvedValueOnce({ data: { id: NEW_REQUEST }, error: null }); // insert

    expect(await sendFriendRequest(THEM)).toEqual({ success: true, requestId: NEW_REQUEST });
    expect(mock.insert).toHaveBeenCalledWith({
      sender_id: ME.id,
      receiver_id: THEM,
      status: "pending",
    });
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it("deletes a rejected row before sending again", async () => {
    mock.single
      .mockResolvedValueOnce({ data: { id: OLD_REQUEST, status: "rejected", sender_id: ME.id }, error: null })
      .mockResolvedValueOnce({ data: { id: NEW_REQUEST }, error: null });
    mock.select
      .mockReturnValueOnce(mock) // existing lookup
      .mockResolvedValueOnce({ data: [{ id: OLD_REQUEST }], error: null }); // delete

    expect(await sendFriendRequest(THEM)).toEqual({ success: true, requestId: NEW_REQUEST });
    expect(mock.delete).toHaveBeenCalled();
    expect(mock.eq).toHaveBeenCalledWith("id", OLD_REQUEST);
    expect(mock.eq).toHaveBeenCalledWith("status", "rejected");
    expect(mock.insert).toHaveBeenCalled();
  });

  it("stops when the rejected row could not be deleted", async () => {
    mock.single.mockResolvedValueOnce({
      data: { id: OLD_REQUEST, status: "rejected", sender_id: THEM },
      error: null,
    });
    mock.select
      .mockReturnValueOnce(mock)
      .mockResolvedValueOnce({ data: [], error: null }); // RLS filtered it out

    expect(await sendFriendRequest(THEM)).toMatchObject({ success: false });
    expect(mock.insert).not.toHaveBeenCalled();
  });

  it("refuses a duplicate pending request", async () => {
    mock.single.mockResolvedValueOnce({
      data: { id: OLD_REQUEST, status: "pending", sender_id: ME.id },
      error: null,
    });

    expect(await sendFriendRequest(THEM)).toEqual({
      success: false,
      error: "Friend request already sent",
    });
    expect(mock.insert).not.toHaveBeenCalled();
  });
});
