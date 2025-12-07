import { createClient } from "@supabase/supabase-js";

// Admin client with service role - SERVER ONLY
// This bypasses Row Level Security, use with caution
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

