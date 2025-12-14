import { createAdminClient } from "@/lib/supabase/admin";
import { sampleBooks } from "@/lib/data/sample-books";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Only allow in development
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Seeding not allowed in production" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const token = searchParams.get("token");

  // If SEED_TOKEN is set in env, require it for destructive operations
  const requiredToken = process.env.SEED_TOKEN;
  if (force && requiredToken && token !== requiredToken) {
    return NextResponse.json(
      { error: "Invalid or missing seed token. Use ?token=YOUR_SEED_TOKEN&force=true" },
      { status: 401 }
    );
  }

  try {
    // Use admin client to bypass RLS
    const supabase = createAdminClient();

    // Check if books already exist
    const { count } = await supabase
      .from("books")
      .select("*", { count: "exact", head: true });

    if (count && count > 0 && !force) {
      return NextResponse.json({
        message: `Database already has ${count} books. Add ?force=true to re-seed.`,
        count,
      });
    }

    // If force, delete existing books first
    if (force && count && count > 0) {
      await supabase.from("books").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // Insert sample books
    const { data, error } = await supabase
      .from("books")
      .insert(sampleBooks)
      .select();

    if (error) {
      console.error("Seed error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      message: `Successfully seeded ${data.length} books`,
      books: data,
    });
  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json(
      { error: "Failed to seed database" },
      { status: 500 }
    );
  }
}

