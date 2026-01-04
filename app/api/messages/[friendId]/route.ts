import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMessages, getConversationFriend } from "@/lib/queries/messages";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ friendId: string }> }
) {
  try {
    const { friendId } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
