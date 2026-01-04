import Link from "next/link";
import { BookOpen, Heart } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { ReadingListWithDetails } from "@/types/database";

interface ListCardProps {
  list: ReadingListWithDetails;
}

export function ListCard({ list }: ListCardProps) {
  return (
    <Link href={`/lists/${list.id}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 space-y-3">
          {/* List Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{list.title}</h3>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{list.book_count} {list.book_count === 1 ? "book" : "books"}</span>
                {list.likes_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" />
                    {list.likes_count}
                  </span>
                )}
              </div>
            </div>
            {list.visibility === "private" && (
              <Badge variant="outline" className="shrink-0">
                Private
              </Badge>
            )}
          </div>

          {/* Description */}
          {list.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {list.description}
            </p>
          )}

          {/* Owner */}
          {list.owner && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Avatar className="h-5 w-5">
                <AvatarImage src={list.owner.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {(list.owner.display_name || list.owner.username)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                By {list.owner.display_name || list.owner.username}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
