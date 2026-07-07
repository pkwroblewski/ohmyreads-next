import Image from "next/image";
import Link from "next/link";
import { Star, MessageSquare, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/utils";
import { CoverImage } from "@/components/books/cover-image";
import type { CommunityFeedItem } from "@/lib/queries/home";

interface CommunityFeedProps {
  items: CommunityFeedItem[];
  title?: string;
}

export function CommunityFeed({
  items,
  title = "Community Feed",
}: CommunityFeedProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="py-10 lg:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl sm:text-2xl font-bold font-serif flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            {title}
          </h2>
          <Link
            href="/books"
            className="text-sm text-primary hover:text-primary/80 transition-colors"
          >
            Browse all reviews
          </Link>
        </div>

        {/* Feed grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <FeedCard key={item.id} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeedCard({ item }: { item: CommunityFeedItem }) {
  const displayName =
    item.user.display_name || item.user.username || "Anonymous Reader";
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <Link href={`/books/${item.book.slug}`}>
      <div
        className={cn(
          "group p-4 rounded-xl border border-border",
          "bg-card/50 backdrop-blur-sm",
          "transition-all duration-200",
          "hover:shadow-md hover:border-primary/30"
        )}
      >
        {/* User info + time */}
        <div className="flex items-center gap-3 mb-3">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {item.user.avatar_url ? (
              <Image
                src={item.user.avatar_url}
                alt={displayName}
                width={36}
                height={36}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                {initials}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            <p className="text-xs text-muted-foreground">
              reviewed {formatRelativeTime(item.created_at)}
            </p>
          </div>

          {/* Rating (optional since reviews can be text-only) */}
          {item.rating !== null && (
            <div className="flex items-center gap-1 bg-accent/10 px-2 py-1 rounded-full">
              <Star className="w-3 h-3 fill-accent text-accent" />
              <span className="text-xs font-semibold">{item.rating}</span>
            </div>
          )}
        </div>

        {/* Book info */}
        <div className="flex gap-3">
          {/* Cover thumbnail */}
          <CoverImage
            book={item.book}
            width={48}
            height={72}
            hover={false}
            className="flex-shrink-0"
          />

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
              {item.book.title}
            </p>
            <p className="text-xs text-muted-foreground truncate mb-1">
              {item.book.author}
            </p>

            {/* Review excerpt */}
            {item.content && (
              <p className="text-xs text-muted-foreground line-clamp-2 italic">
                &ldquo;{item.content}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* "Read more" hint */}
        <div className="mt-3 pt-2 border-t border-border/50 flex items-center gap-1 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
          <MessageSquare className="w-3 h-3" />
          Read full review
        </div>
      </div>
    </Link>
  );
}

