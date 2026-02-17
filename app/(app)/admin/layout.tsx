import { redirect } from "next/navigation";
import { createClient, getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    data: { user },
  } = await getUser();

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  // Check if user is admin - use maybeSingle() to avoid error when no row exists
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("Admin profile fetch error:", profileError);
  }

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}

