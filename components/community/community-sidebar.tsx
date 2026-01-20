"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CoverImage } from "@/components/books/cover-image";
import type { CommunitySidebarData } from "@/lib/queries/community";

interface CommunitySidebarProps {
  data: CommunitySidebarData;
}

export function CommunitySidebar({ data }: CommunitySidebarProps) {
  return (
    <div className="space-y-4">
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

