import { redirect } from "next/navigation";
import { checkAdmin } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await checkAdmin();

  if (!admin.ok) {
    redirect(
      admin.reason === "unauthenticated" ? "/login?redirect=/admin" : "/dashboard"
    );
  }

  return <>{children}</>;
}

