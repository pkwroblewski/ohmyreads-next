"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Shield,
  ShieldOff,
  Eye,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BookOpen,
  MessageSquare,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  adminGetUsers,
  adminToggleAdmin,
  adminGetUserStats,
  type UserFilters,
  type UserWithStats,
} from "@/lib/actions/admin-users";

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, admins: 0, newToday: 0 });

  // Filters
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState<string>("all");
  const [sortBy, setSortBy] = useState<UserFilters["sortBy"]>("created_at");
  const [sortOrder, setSortOrder] = useState<UserFilters["sortOrder"]>("desc");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Admin toggle dialog
  const [toggleDialogOpen, setToggleDialogOpen] = useState(false);
  const [userToToggle, setUserToToggle] = useState<UserWithStats | null>(null);
  const [toggling, setToggling] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await adminGetUsers({
      search: search || undefined,
      isAdmin: isAdmin === "all" ? undefined : isAdmin === "true",
      sortBy,
      sortOrder,
      page,
      limit,
    });

    if (result.success) {
      setUsers(result.users || []);
      setTotal(result.total || 0);
      setTotalPages(result.totalPages || 0);
    }
    setLoading(false);
  }, [search, isAdmin, sortBy, sortOrder, page]);

  const fetchStats = useCallback(async () => {
    const result = await adminGetUserStats();
    if (result.success && result.stats) {
      setStats(result.stats);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      fetchUsers();
    }, 300);
    return () => clearTimeout(debounce);
  }, [fetchUsers]);

  const handleToggleAdmin = async () => {
    if (!userToToggle) return;

    setToggling(true);
    const result = await adminToggleAdmin(userToToggle.id);
    setToggling(false);

    if (result.success) {
      setToggleDialogOpen(false);
      setUserToToggle(null);
      fetchUsers();
      fetchStats();
    }
  };

  const openToggleDialog = (user: UserWithStats) => {
    setUserToToggle(user);
    setToggleDialogOpen(true);
  };

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
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or display name..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </div>

        <Select
          value={isAdmin}
          onValueChange={(v) => {
            setIsAdmin(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="User type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="true">Admins Only</SelectItem>
            <SelectItem value="false">Non-Admins</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortBy}
          onValueChange={(v) => setSortBy(v as UserFilters["sortBy"])}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_at">Join Date</SelectItem>
            <SelectItem value="username">Username</SelectItem>
            <SelectItem value="books_count">Books</SelectItem>
            <SelectItem value="reviews_count">Reviews</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={sortOrder}
          onValueChange={(v) => setSortOrder(v as UserFilters["sortOrder"])}
        >
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Newest</SelectItem>
            <SelectItem value="asc">Oldest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
                              href={`/u/${user.username}`}
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openToggleDialog(user)}
                          title={user.is_admin ? "Remove Admin" : "Make Admin"}
                        >
                          {user.is_admin ? (
                            <ShieldOff className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Page {page} of {totalPages} ({total} users)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page >= totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Toggle Admin Dialog */}
      <AlertDialog open={toggleDialogOpen} onOpenChange={setToggleDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {userToToggle?.is_admin ? (
                <>
                  <ShieldOff className="h-5 w-5 text-orange-500" />
                  Remove Admin Rights
                </>
              ) : (
                <>
                  <Shield className="h-5 w-5 text-primary" />
                  Grant Admin Rights
                </>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToToggle?.is_admin ? (
                <>
                  Are you sure you want to remove admin rights from{" "}
                  <strong>{userToToggle?.username}</strong>? They will lose
                  access to the admin dashboard.
                </>
              ) : (
                <>
                  Are you sure you want to grant admin rights to{" "}
                  <strong>{userToToggle?.username}</strong>? They will have full
                  access to manage books, users, and site settings.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggling}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleToggleAdmin}
              disabled={toggling}
              className={
                userToToggle?.is_admin
                  ? "bg-orange-500 hover:bg-orange-600"
                  : ""
              }
            >
              {toggling ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : userToToggle?.is_admin ? (
                "Remove Admin"
              ) : (
                "Grant Admin"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
