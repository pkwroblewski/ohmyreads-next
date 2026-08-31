import { AdminListSkeleton } from "@/components/admin/admin-table-skeleton";

export default function AdminLogsLoading() {
  return <AdminListSkeleton statCards={0} filters={1} rows={10} />;
}
