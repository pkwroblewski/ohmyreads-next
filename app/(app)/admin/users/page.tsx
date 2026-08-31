import type { Metadata } from "next";
import Link from "next/link";
import { Users, Eye, BookOpen, MessageSquare, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  AdminSearchInput,
  AdminSelectFilter,
} from "@/components/admin/admin-filters";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { UserAdminToggle } from "@/components/admin/user-admin-toggle";
import {
  adminGetUsers,
  adminGetUserStats,
  type UserFilters,
} from "@/lib/actions/admin-users";
import {
  toAdminParams,
  readPage,
  readEnum,
  type RawSearchParams,
} from "@/lib/admin/search-params";

export const metadata: Metadata = {
  title: "Manage Users | Admin",
  robots: { index: false, follow: false },
};

const PATHNAME = "/admin/users";
const LIMIT = 20;

const SORT_FIELDS = [
  "created_at",
  "username",
  "books_count",
  "reviews_count",
] as const satisfies readonly NonNullable<UserFilters["sortBy"]>[];

const SORT_ORDERS = ["desc", "asc"] as const;
const ADMIN_FILTERS = ["all", "true", "false"] as const;

interface PageProps {
  searchParams: Promise<RawSearchParams>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const params = toAdminParams(await searchParams);

  const search = params.search ?? "";
  const isAdminFilter = readEnum(params, "isAdmin", ADMIN_FILTERS, "all");
  const sortBy = readEnum(params, "sortBy", SORT_FIELDS, "created_at");
  const sortOrder = readEnum(params, "sortOrder", SORT_ORDERS, "desc");
  const page = readPage(params);

  const [result, statsResult] = await Promise.all([
    adminGetUsers({
      search: search || undefined,
      isAdmin: isAdminFilter === "all" ? undefined : isAdminFilter === "true",
      sortBy,
      sortOrder,
      page,
      limit: LIMIT,
    }),
    adminGetUserStats(),
  ]);

  const users = result.success ? result.users ?? [] : [];
  const total = result.success ? result.total ?? 0 : 0;
  const totalPages = result.success ? result.totalPages ?? 0 : 0;
  const stats = statsResult.success
    ? statsResult.stats ?? { total: 0, admins: 0, newToday: 0 }
    : { total: 0, admins: 0, newToday: 0 };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Users className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif">Manage Users</h1>
            <p className="text-muted-foreground">
              {total.toLocaleString()} registered users
            </p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-card border">
          <p className="text-2xl font-bold">{stats.total.toLocaleString()}</p>
          <p className="text-sm text-muted-foreground">Total Users</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <p className="text-2xl font-bold">{stats.admins}</p>
          <p className="text-sm text-muted-foreground">Admin Users</p>
        </div>
        <div className="p-4 rounded-xl bg-card border">
          <p className="text-2xl font-bold">{stats.newToday}</p>
          <p className="text-sm text-muted-foreground">New Today</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-card border">
        <div className="flex-1 min-w-[200px]">
          <AdminSearchInput
            pathname={PATHNAME}
            params={params}
            placeholder="Search by username or display name..."
          />
        </div>

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="isAdmin"
          value={isAdminFilter}
          defaultValue="all"
          placeholder="User type"
          options={[
            { value: "all", label: "All Users" },
            { value: "true", label: "Admins Only" },
            { value: "false", label: "Non-Admins" },
          ]}
        />

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="sortBy"
          value={sortBy}
          defaultValue="created_at"
          placeholder="Sort by"
          options={[
            { value: "created_at", label: "Join Date" },
            { value: "username", label: "Username" },
            { value: "books_count", label: "Books" },
            { value: "reviews_count", label: "Reviews" },
          ]}
        />

        <AdminSelectFilter
          pathname={PATHNAME}
          params={params}
          name="sortOrder"
          value={sortOrder}
          defaultValue="desc"
          className="w-[120px]"
          options={[
            { value: "desc", label: "Newest" },
            { value: "asc", label: "Oldest" },
          ]}
        />
      </div>

      {/* Users Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {!result.success ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Could not load users</p>
            <p className="text-sm">{result.error || "Please try again."}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No users found</p>
            <p className="text-sm">Try adjusting your search filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium">User</th>
                  <th className="text-center p-4 font-medium hidden sm:table-cell">Books</th>
                  <th className="text-center p-4 font-medium hidden sm:table-cell">Reviews</th>
                  <th className="text-center p-4 font-medium hidden md:table-cell">Joined</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>
                            {user.username.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link
                              href={`/users/${user.username}`}
                              className="font-medium hover:text-primary transition-colors"
                            >
                              {user.display_name || user.username}
                            </Link>
                            {user.is_admin && (
                              <Badge variant="secondary" className="gap-1">
                                <Crown className="h-3 w-3" />
                                Admin
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            @{user.username}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <BookOpen className="h-4 w-4" />
                        {user.books_count}
                      </div>
                    </td>
                    <td className="p-4 text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1 text-muted-foreground">
                        <MessageSquare className="h-4 w-4" />
                        {user.reviews_count}
                      </div>
                    </td>
                    <td className="p-4 text-center hidden md:table-cell">
                      <span className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/admin/users/${user.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
                        <UserAdminToggle
                          userId={user.id}
                          username={user.username}
                          isAdmin={user.is_admin}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AdminPagination
          pathname={PATHNAME}
          params={params}
          page={page}
          totalPages={totalPages}
          total={total}
          label="users"
        />
      </div>
    </div>
  );
}
