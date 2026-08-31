import { AdminListSkeleton } from "@/components/admin/admin-table-skeleton";

export default function AdminBooksLoading() {
  return <AdminListSkeleton statCards={0} filters={3} />;
}
