import { AdminListSkeleton } from "@/components/admin/admin-table-skeleton";

export default function AdminReviewsLoading() {
  return <AdminListSkeleton statCards={4} filters={4} />;
}
