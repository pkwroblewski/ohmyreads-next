import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { getUserBooks, SHELF_PAGE_SIZE } from "@/lib/queries/users";
import { isForeignOrigin } from "@/lib/utils/csrf";
import { logError } from "@/lib/utils/log";

const STATUSES = new Set(["reading", "read", "want_to_read"]);

/**
 * One page of the signed-in reader's own shelf, for the "Load more" button
 * on /my-shelf. Filters: `status` (one of the three shelf statuses) or
 * `shelf` (a custom shelf id); `offset` and `limit` page through the rows.
 */
export async function GET(request: NextRequest) {
  if (isForeignOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const {
      data: { user },
    } = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const status = params.get("status") ?? undefined;
    const shelfId = params.get("shelf") ?? undefined;
    const offset = Math.max(0, Number.parseInt(params.get("offset") ?? "0", 10) || 0);
    const limit = Math.min(
      SHELF_PAGE_SIZE,
      Math.max(1, Number.parseInt(params.get("limit") ?? "", 10) || SHELF_PAGE_SIZE)
    );

    if (status && !STATUSES.has(status)) {
      return NextResponse.json({ error: "Unknown status" }, { status: 400 });
    }

    const { userBooks, total } = await getUserBooks(user.id, {
      status: status as "reading" | "read" | "want_to_read" | undefined,
      shelfId,
      offset,
      limit,
    });

    return NextResponse.json({ books: userBooks, total });
  } catch (error) {
    logError("Error fetching shelf page", error);
    return NextResponse.json({ error: "Failed to load shelf" }, { status: 500 });
  }
}
