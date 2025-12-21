import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CoverImage } from "@/components/books/cover-image";
import type { CommunitySidebarData } from "@/lib/queries/community";

interface CommunitySidebarProps {
  data: CommunitySidebarData;
}

export function CommunitySidebar({ data }: CommunitySidebarProps) {
  return (
    <div className="space-y-4">
      {/* Who to Follow */}
      {data.activeReaders.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Who to Follow</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.activeReaders.map((reader) => {
              const displayName = reader.display_name || reader.username || "Reader";
              return (
                <div key={reader.id} className="flex items-center gap-3">
                  <Link href={`/users/${reader.username || reader.id}`}>
                    <Avatar size="sm">
                      {reader.avatar_url ? (
                        <AvatarImage src={reader.avatar_url} alt={displayName} />
                      ) : (
                        <AvatarFallback initials={getInitials(displayName)} />
                      )}
                    </Avatar>
                  </Link>
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/users/${reader.username || reader.id}`}
                      className="text-sm font-medium hover:text-primary transition-colors block truncate"
                    >
                      {displayName}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      @{reader.username || "reader"}
                    </p>
                  </div>
                  <Button size="sm" variant="default" className="flex-shrink-0">
                    Follow
                  </Button>
                </div>
              );
            })}
            <Link
              href="/discover"
              className="flex items-center justify-center gap-1.5 mt-2 pt-2 border-t text-sm text-primary hover:text-primary/80 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Find More Readers
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Popular This Week */}
      {data.popularBooks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <h3 className="text-sm font-semibold">Popular this Week</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.popularBooks.map((book) => (
              <Link
                key={book.id}
                href={`/books/${book.slug}`}
                className="flex gap-3 group"
              >
                <CoverImage
                  book={book}
                  width={40}
                  height={60}
                  hover={false}
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                    {book.title}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {book.author}
                  </p>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

