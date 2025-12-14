import Link from "next/link";
import Image from "next/image";
import { BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage, getInitials } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { CommunitySidebarData } from "@/lib/queries/community";

interface CommunitySidebarProps {
  data: CommunitySidebarData;
}

const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjEwMCUiIGhlaWdodD0iMTAwJSIgZmlsbD0iIzMzMyIvPjwvc3ZnPg==";

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
                <div className="flex-shrink-0 w-10 h-[60px] rounded overflow-hidden bg-muted">
                  {book.cover_url ? (
                    <Image
                      src={book.cover_url}
                      alt={book.title}
                      width={40}
                      height={60}
                      className="object-cover w-full h-full"
                      placeholder="blur"
                      blurDataURL={BLUR_DATA_URL}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
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

