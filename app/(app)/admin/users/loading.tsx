import { AdminListSkeleton } from "@/components/admin/admin-table-skeleton";

export default function AdminUsersLoading() {
  return <AdminListSkeleton statCards={3} filters={3} />;
}
