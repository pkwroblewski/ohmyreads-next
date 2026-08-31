import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/server";
import { logError } from "@/lib/utils/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for uptime monitoring.
 *
 * Public on purpose — an uptime monitor cannot hold a session — so the body
 * carries no configuration, no counts, and no error detail: a failure only
 * ever says "the database did not answer". The probe itself is a `HEAD`
 * against `books` through the anon key, which returns no rows and reads a
 * single index entry, so it costs about as little as a query can while still
 * proving that the Postgres connection and the PostgREST layer are alive.
 */
const PROBE_TIMEOUT_MS = 5000;

export async function GET() {
  const timestamp = new Date().toISOString();
  const headers = { "Cache-Control": "no-store" };

  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return NextResponse.json(
      { status: "error", database: "unreachable", timestamp },
      { status: 503, headers }
    );
  }

  try {
    const supabase = createPublicClient();
    const { error } = await supabase
      .from("books")
      .select("id", { head: true })
      .limit(1)
      .abortSignal(AbortSignal.timeout(PROBE_TIMEOUT_MS));

    if (error) {
      logError("Health check database probe failed", error);
      return NextResponse.json(
        { status: "error", database: "unreachable", timestamp },
        { status: 503, headers }
      );
    }
  } catch (error) {
    // Thrown rather than returned: the abort signal fired, or the fetch to
    // Supabase never resolved.
    logError("Health check database probe threw", error);
    return NextResponse.json(
      { status: "error", database: "unreachable", timestamp },
      { status: 503, headers }
    );
  }

  return NextResponse.json(
    { status: "ok", database: "ok", timestamp },
    { status: 200, headers }
  );
}
