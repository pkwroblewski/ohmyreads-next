import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getConversations, getUnreadCount } from "@/lib/queries/messages";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [conversations, unreadCount] = await Promise.all([
      getConversations(),
      getUnreadCount(),
    ]);

    return NextResponse.json({
      conversations,
      unreadCount,
    });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return NextResponse.json(
      { error: "Failed to fetch conversations" },
      { status: 500 }
    );
  }
}
