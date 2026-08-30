import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMessages, getConversationFriend } from "@/lib/queries/messages";
import { friendIdSchema } from "@/lib/validation/message";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ friendId: string }> }
) {
  try {
    const { friendId: rawFriendId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Validate before use: this value is interpolated into PostgREST .or()
    // filter strings downstream, where `.` `,` `(` `)` are structural. A UUID
    // cannot contain them, so validating the shape closes the injection path.
    const idResult = friendIdSchema.safeParse(rawFriendId);
    if (!idResult.success) {
      return NextResponse.json({ error: "Invalid friend ID" }, { status: 400 });
    }
    const friendId = idResult.data;

    // Verify friendship and get friend info
    const friend = await getConversationFriend(friendId);

    if (!friend) {
      return NextResponse.json(
        { error: "Friend not found or not a friend" },
        { status: 404 }
      );
    }

    // Get messages
    const { messages } = await getMessages(friendId, 50);

    return NextResponse.json({
      friend,
      messages,
    });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
