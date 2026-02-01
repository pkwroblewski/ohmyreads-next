import type { Metadata } from "next";
import Link from "next/link";
import {
  Shield,
  BookOpen,
  Users,
  MessageSquare,
  MapPin,
  FileText,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Star,
  BarChart3,
  Settings,
  Flag,
  Upload,
  Eye,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  robots: { index: false, follow: false },
};

// Stat card component
function StatCard({
  title,
  value,
  icon: Icon,
  href,
  trend,
  variant = "default",
}: {
  title: string;
  value: number | string;
  icon: typeof Shield;
  href?: string;
  trend?: { value: number; label: string };
  variant?: "default" | "warning" | "success" | "danger";
}) {
  const variantClasses = {
    default: "bg-card border-border",
    warning: "bg-yellow-500/10 border-yellow-500/20",
    success: "bg-green-500/10 border-green-500/20",
    danger: "bg-red-500/10 border-red-500/20",
  };

  const iconClasses = {
    default: "text-primary",
    warning: "text-yellow-600 dark:text-yellow-400",
    success: "text-green-600 dark:text-green-400",
    danger: "text-red-600 dark:text-red-400",
  };

  const content = (
    <div
      className={cn(
        "p-5 rounded-xl border transition-all",
        variantClasses[variant],
        href && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <Icon className={cn("h-6 w-6", iconClasses[variant])} aria-hidden="true" />
        {trend && (
          <span
            className={cn(
              "text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1",
              trend.value >= 0
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            <TrendingUp
              className={cn("h-3 w-3", trend.value < 0 && "rotate-180")}
              aria-hidden="true"
            />
            <span className="sr-only">{trend.value >= 0 ? "Up" : "Down"}</span>
            {trend.value >= 0 ? "+" : ""}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-sm text-muted-foreground mt-1">{title}</p>
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

// Quick action card component
function QuickActionCard({
  title,
  description,
  icon: Icon,
  href,
  badge,
  variant = "default",
}: {
  title: string;
  description: string;
  icon: typeof Shield;
  href: string;
  badge?: number;
  variant?: "default" | "primary";
}) {
  return (
    <Link href={href}>
      <div
        className={cn(
          "group p-5 rounded-xl border transition-all",
          "hover:shadow-lg hover:-translate-y-1",
          variant === "primary"
            ? "bg-primary/5 border-primary/20 hover:bg-primary/10"
            : "bg-card border-border hover:bg-muted/50"
        )}
      >
        <div className="flex items-start justify-between mb-3">
          <div
            className={cn(
              "p-2.5 rounded-lg transition-all",
              variant === "primary"
                ? "bg-primary/10 group-hover:bg-primary/20"
                : "bg-muted group-hover:bg-muted/80"
            )}
          >
            <Icon
              className={cn(
                "h-5 w-5",
                variant === "primary" ? "text-primary" : "text-muted-foreground"
              )}
              aria-hidden="true"
            />
          </div>
          {badge !== undefined && badge > 0 && (
            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-destructive text-destructive-foreground">
              {badge}
            </span>
          )}
        </div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch stats in parallel
  const [
    usersCount,
    booksCount,
    reviewsCount,
    placesCount,
    pendingBookSubmissions,
    pendingPlaces,
    recentReviews,
    todayStats,
  ] = await Promise.all([
    // Total users
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    // Total books
    supabase.from("books").select("id", { count: "exact", head: true }),
    // Total reviews
    supabase.from("reviews").select("id", { count: "exact", head: true }),
    // Total places
    supabase.from("places").select("id", { count: "exact", head: true }),
    // Pending book submissions
    supabase
      .from("book_submissions")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Pending places
    supabase
      .from("places")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    // Recent reviews (for moderation overview)
    supabase
      .from("reviews")
      .select("id, rating, summary, created_at, book:books(title)")
      .order("created_at", { ascending: false })
      .limit(5),
    // Today's new content
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .gte("created_at", new Date().toISOString().split("T")[0]),
  ]);

  const totalPending =
    (pendingBookSubmissions.count || 0) + (pendingPlaces.count || 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Shield className="h-8 w-8 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-3xl font-bold font-serif">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Manage content, users, and site settings
            </p>
          </div>
        </div>
        <Link href="/settings">
          <Button variant="outline" size="sm">
            <Settings className="h-4 w-4 mr-2" aria-hidden="true" />
            Settings
          </Button>
        </Link>
      </div>

      {/* Alert Banner for Pending Items */}
      {totalPending > 0 && (
        <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-4" role="alert">
          <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">
              {totalPending} items pending review
            </p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              {pendingBookSubmissions.count || 0} book submissions,{" "}
              {pendingPlaces.count || 0} places waiting for approval
            </p>
          </div>
          <Link href="/admin/moderation/books">
            <Button size="sm" variant="outline" className="border-yellow-500/50">
              Review Now
            </Button>
          </Link>
        </div>
      )}

      {/* Overview Stats */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Users"
            value={usersCount.count?.toLocaleString() || 0}
            icon={Users}
            trend={{ value: 12, label: "this month" }}
          />
          <StatCard
            title="Total Books"
            value={booksCount.count?.toLocaleString() || 0}
            icon={BookOpen}
          />
          <StatCard
            title="Total Reviews"
            value={reviewsCount.count?.toLocaleString() || 0}
            icon={MessageSquare}
            trend={{ value: 8, label: "this week" }}
          />
          <StatCard
            title="Places"
            value={placesCount.count?.toLocaleString() || 0}
            icon={MapPin}
          />
        </div>
      </section>

      {/* Moderation Stats */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Moderation Queue</h2>
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            title="Pending Book Submissions"
            value={pendingBookSubmissions.count || 0}
            icon={Clock}
            href="/admin/moderation/books"
            variant={
              (pendingBookSubmissions.count || 0) > 0 ? "warning" : "success"
            }
          />
          <StatCard
            title="Pending Places"
            value={pendingPlaces.count || 0}
            icon={MapPin}
            href="/admin/moderation/places"
            variant={(pendingPlaces.count || 0) > 0 ? "warning" : "success"}
          />
          <StatCard
            title="Reviews Today"
            value={todayStats.count || 0}
            icon={Star}
            variant="default"
          />
        </div>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <QuickActionCard
            title="Review Book Submissions"
            description="Approve or reject user-submitted books"
            icon={FileText}
            href="/admin/moderation/books"
            badge={pendingBookSubmissions.count || undefined}
            variant="primary"
          />
          <QuickActionCard
            title="Moderate Places"
            description="Review bookstores and libraries submissions"
            icon={MapPin}
            href="/admin/moderation/places"
            badge={pendingPlaces.count || undefined}
          />
          <QuickActionCard
            title="Add New Book"
            description="Manually add a book to the catalog"
            icon={Upload}
            href="/books/new"
          />
          <QuickActionCard
            title="View All Submissions"
            description="See complete submission history"
            icon={Eye}
            href="/admin/submissions"
          />
          <QuickActionCard
            title="User Reports"
            description="Review flagged content and users"
            icon={Flag}
            href="/admin/reports"
          />
          <QuickActionCard
            title="Analytics"
            description="View site traffic and engagement"
            icon={BarChart3}
            href="/admin/analytics"
          />
        </div>
      </section>

      {/* Recent Reviews */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Reviews</h2>
          <Link
            href="/admin/reviews"
            className="text-sm text-primary hover:underline"
          >
            View all
          </Link>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {recentReviews.data && recentReviews.data.length > 0 ? (
            <div className="divide-y divide-border">
              {recentReviews.data.map((review) => {
                const book = Array.isArray(review.book)
                  ? review.book[0]
                  : review.book;
                return (
                  <div
                    key={review.id}
                    className="p-4 flex items-center gap-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-1 text-accent">
                      <Star className="h-4 w-4 fill-current" aria-hidden="true" />
                      <span className="sr-only">Rating:</span>
                      <span className="font-medium">{review.rating}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {book?.title || "Unknown Book"}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {review.summary || "No summary"}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(review.created_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" aria-hidden="true" />
              <p>No recent reviews</p>
            </div>
          )}
        </div>
      </section>

      {/* Admin Tools Grid */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Admin Tools</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Manage Users", href: "/admin/users", icon: Users },
            { label: "Manage Books", href: "/admin/books", icon: BookOpen },
            { label: "Manage Reviews", href: "/admin/reviews", icon: Star },
            { label: "Manage Places", href: "/admin/places", icon: MapPin },
            { label: "Email Settings", href: "/admin/email", icon: MessageSquare },
            { label: "Site Settings", href: "/admin/settings", icon: Settings },
            { label: "Audit Logs", href: "/admin/logs", icon: FileText },
            { label: "Import Data", href: "/admin/import", icon: Upload },
          ].map((tool) => (
            <Link
              key={tool.label}
              href={tool.href}
              className={cn(
                "flex items-center gap-3 p-4 rounded-lg border border-border",
                "bg-card hover:bg-muted/50 transition-colors",
                "text-sm font-medium"
              )}
            >
              <tool.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              {tool.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
