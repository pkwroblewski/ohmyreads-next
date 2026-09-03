/**
 * Custom shelves (Phase 2, Task 21, T2).
 *
 * Every mutation refuses an anonymous caller, and every one that takes a
 * shelf id refuses a shelf the caller does not own — before it writes. The
 * two RPC-backed reconciliations pass the RPC's two user-facing refusals
 * through verbatim and mask anything else.
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

import {
  createShelf,
  updateShelf,
  deleteShelf,
  addBookToShelf,
  removeBookFromShelf,
  updateBookShelves,
  addBookToShelfByBookId,
  updateBookShelvesByBookId,
} from "@/lib/actions/shelves";

const ME = { id: "550e8400-e29b-41d4-a716-446655440000" };
const OTHER = "550e8400-e29b-41d4-a716-446655440009";
const SHELF = "550e8400-e29b-41d4-a716-446655440010";
const USER_BOOK = "550e8400-e29b-41d4-a716-446655440020";
const BOOK = "550e8400-e29b-41d4-a716-446655440030";

beforeEach(() => {
  vi.clearAllMocks();
  mock = createMockSupabase(ME);
  checkRateLimit.mockResolvedValue({ allowed: true });
});

const mutations: Array<[string, () => Promise<{ error?: string }>]> = [
  ["createShelf", () => createShelf({ name: "Favourites" })],
  ["updateShelf", () => updateShelf({ shelfId: SHELF, name: "Renamed" })],
  ["deleteShelf", () => deleteShelf(SHELF)],
  ["addBookToShelf", () => addBookToShelf({ shelfId: SHELF, userBookId: USER_BOOK })],
  ["removeBookFromShelf", () => removeBookFromShelf({ shelfId: SHELF, userBookId: USER_BOOK })],
  ["updateBookShelves", () => updateBookShelves({ userBookId: USER_BOOK, shelfIds: [SHELF] })],
  ["addBookToShelfByBookId", () => addBookToShelfByBookId({ shelfId: SHELF, bookId: BOOK })],
  ["updateBookShelvesByBookId", () => updateBookShelvesByBookId({ bookId: BOOK, shelfIds: [SHELF] })],
];

describe("every shelf mutation", () => {
  it("refuses an anonymous caller without touching the database", async () => {
    mock = createMockSupabase(null);
    for (const [name, run] of mutations) {
      expect(await run(), name).toEqual({ error: "Not authenticated" });
    }
    expect(mock.from).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
  });

  it("stops at its rate limit before touching the database", async () => {
    checkRateLimit.mockResolvedValue({ allowed: false });
    for (const [name, run] of mutations) {
      expect((await run()).error, name).toMatch(/too many/i);
    }
    expect(mock.from).not.toHaveBeenCalled();
  });
});

describe("ownership", () => {
  const ownerChecked: Array<[string, () => Promise<{ error?: string }>]> = mutations.filter(([n]) =>
    ["updateShelf", "deleteShelf", "addBookToShelf", "removeBookFromShelf", "addBookToShelfByBookId"].includes(n)
  );

  it("refuses a shelf that belongs to someone else, before any write", async () => {
    for (const [name, run] of ownerChecked) {
      mock = createMockSupabase(ME);
      mock.single.mockResolvedValueOnce({ data: { user_id: OTHER }, error: null });

      expect(await run(), name).toEqual({ error: "Shelf not found or not authorized" });
      expect(mock.eq, name).toHaveBeenCalledWith("id", SHELF);
      expect(mock.update, name).not.toHaveBeenCalled();
      expect(mock.delete, name).not.toHaveBeenCalled();
      expect(mock.insert, name).not.toHaveBeenCalled();
    }
  });

  it("treats a missing shelf the same way", async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: null });
    expect(await deleteShelf(SHELF)).toEqual({ error: "Shelf not found or not authorized" });
    expect(mock.delete).not.toHaveBeenCalled();
  });

  it("addBookToShelf also refuses a user_book that is not the caller's", async () => {
    mock.single
      .mockResolvedValueOnce({ data: { user_id: ME.id }, error: null }) // shelf is mine
      .mockResolvedValueOnce({ data: { user_id: OTHER }, error: null }); // book is not

    expect(await addBookToShelf({ shelfId: SHELF, userBookId: USER_BOOK })).toEqual({
      error: "Book not found in your shelf",
    });
    expect(mock.insert).not.toHaveBeenCalled();
  });
});

describe("happy paths", () => {
  it("createShelf refuses a duplicate name, otherwise inserts with the next sort order", async () => {
    mock.single.mockResolvedValueOnce({ data: { id: "dup" }, error: null });
    expect(await createShelf({ name: "Favourites" })).toEqual({ error: "You already have a shelf with this name" });
    expect(mock.insert).not.toHaveBeenCalled();

    mock.single
      .mockResolvedValueOnce({ data: null, error: null }) // no duplicate
      .mockResolvedValueOnce({ data: { sort_order: 4 }, error: null }) // last shelf
      .mockResolvedValueOnce({ data: { id: SHELF, name: "Favourites" }, error: null }); // inserted
    const result = await createShelf({ name: "Favourites", isPublic: false });
    expect(result).toEqual({ shelf: { id: SHELF, name: "Favourites" } });
    expect(mock.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: ME.id, name: "Favourites", is_public: false, sort_order: 5 })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");
  });

  it("updateShelf writes only the given fields and revalidates the shelf page", async () => {
    mock.single.mockResolvedValueOnce({ data: { user_id: ME.id }, error: null });

    expect(await updateShelf({ shelfId: SHELF, name: "Renamed", description: "" })).toEqual({ success: true });
    expect(mock.update).toHaveBeenCalledWith({ name: "Renamed", description: null });
    expect(mock.eq).toHaveBeenCalledWith("id", SHELF);
    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");
  });

  it("deleteShelf deletes the owner's shelf by id", async () => {
    mock.single.mockResolvedValueOnce({ data: { user_id: ME.id }, error: null });
    expect(await deleteShelf(SHELF)).toEqual({ success: true });
    expect(mock.delete).toHaveBeenCalled();
    expect(mock.eq).toHaveBeenLastCalledWith("id", SHELF);
    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");
  });

  it("addBookToShelf inserts the pair and turns the unique violation into a plain message", async () => {
    mock.single
      .mockResolvedValueOnce({ data: { user_id: ME.id }, error: null })
      .mockResolvedValueOnce({ data: { user_id: ME.id }, error: null });
    mock.insert.mockResolvedValueOnce({ error: null });
    expect(await addBookToShelf({ shelfId: SHELF, userBookId: USER_BOOK, notes: "loved it" })).toEqual({ success: true });
    expect(mock.insert).toHaveBeenCalledWith({ shelf_id: SHELF, user_book_id: USER_BOOK, notes: "loved it" });

    mock.single
      .mockResolvedValueOnce({ data: { user_id: ME.id }, error: null })
      .mockResolvedValueOnce({ data: { user_id: ME.id }, error: null });
    mock.insert.mockResolvedValueOnce({ error: { code: "23505" } });
    expect(await addBookToShelf({ shelfId: SHELF, userBookId: USER_BOOK })).toEqual({
      error: "Book is already on this shelf",
    });
  });

  it("removeBookFromShelf deletes the pair scoped to both ids", async () => {
    mock.single.mockResolvedValueOnce({ data: { user_id: ME.id }, error: null });
    expect(await removeBookFromShelf({ shelfId: SHELF, userBookId: USER_BOOK })).toEqual({ success: true });
    expect(mock.delete).toHaveBeenCalled();
    expect(mock.eq).toHaveBeenCalledWith("shelf_id", SHELF);
    expect(mock.eq).toHaveBeenCalledWith("user_book_id", USER_BOOK);
  });

  it("updateBookShelves reconciles through the RPC and passes its two refusals through", async () => {
    expect(await updateBookShelves({ userBookId: USER_BOOK, shelfIds: [SHELF] })).toEqual({ success: true });
    expect(mock.rpc).toHaveBeenCalledWith("set_book_shelves", { p_user_book_id: USER_BOOK, p_shelf_ids: [SHELF] });
    expect(revalidatePath).toHaveBeenCalledWith("/my-shelf");

    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "Book not found in your shelf" } });
    expect(await updateBookShelves({ userBookId: USER_BOOK, shelfIds: [] })).toEqual({ error: "Book not found in your shelf" });

    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: "One or more shelves not found" } });
    expect(await updateBookShelves({ userBookId: USER_BOOK, shelfIds: [SHELF] })).toEqual({ error: "One or more shelves not found" });

    // Anything else from the RPC is masked (reportError → its message)
    mock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'relation "x" does not exist' } });
    expect(await updateBookShelves({ userBookId: USER_BOOK, shelfIds: [SHELF] })).toEqual({ error: "Error updating book shelves" });
  });

  it("addBookToShelfByBookId creates a want_to_read entry when the book is not in the library yet", async () => {
    mock.single
      .mockResolvedValueOnce({ data: { user_id: ME.id }, error: null }) // shelf owner
      .mockResolvedValueOnce({ data: null, error: null }) // no user_book
      .mockResolvedValueOnce({ data: { id: USER_BOOK }, error: null }); // created
    mock.insert
      .mockReturnValueOnce(mock) // user_books insert → .select().single()
      .mockResolvedValueOnce({ error: null }); // shelf_books insert

    const result = await addBookToShelfByBookId({ shelfId: SHELF, bookId: BOOK });

    expect(result).toEqual({ success: true, userBookId: USER_BOOK });
    expect(mock.insert).toHaveBeenNthCalledWith(1, { user_id: ME.id, book_id: BOOK, status: "want_to_read" });
    expect(mock.insert).toHaveBeenNthCalledWith(2, { shelf_id: SHELF, user_book_id: USER_BOOK });
  });

  it("updateBookShelvesByBookId does nothing for a book not in the library and no shelves", async () => {
    mock.single.mockResolvedValueOnce({ data: null, error: null });
    expect(await updateBookShelvesByBookId({ bookId: BOOK, shelfIds: [] })).toEqual({ success: true });
    expect(mock.insert).not.toHaveBeenCalled();
    expect(mock.rpc).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("updateBookShelvesByBookId reuses the existing user_book and reconciles via the RPC", async () => {
    mock.single.mockResolvedValueOnce({ data: { id: USER_BOOK }, error: null });
    expect(await updateBookShelvesByBookId({ bookId: BOOK, shelfIds: [SHELF] })).toEqual({
      success: true,
      userBookId: USER_BOOK,
    });
    expect(mock.rpc).toHaveBeenCalledWith("set_book_shelves", { p_user_book_id: USER_BOOK, p_shelf_ids: [SHELF] });
  });
});
