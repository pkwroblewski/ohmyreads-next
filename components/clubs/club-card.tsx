import Link from "next/link";
import { Users, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CoverImageMini } from "@/components/books/cover-image";
import type { BookClubWithDetails } from "@/types/database";

interface ClubCardProps {
  club: BookClubWithDetails;
}

export function ClubCard({ club }: ClubCardProps) {
  return (
    <Link href={`/clubs/${club.slug}`}>
      <Card className="h-full hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 space-y-3">
          {/* Club Header */}
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold truncate">{club.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5" />
                <span>{club.member_count} {club.member_count === 1 ? "member" : "members"}</span>
              </div>
            </div>
            {club.is_member && (
              <Badge variant="secondary" className="shrink-0">
                {club.user_role === "admin" ? "Admin" : "Member"}
              </Badge>
            )}
          </div>

          {/* Description */}
          {club.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {club.description}
            </p>
          )}

          {/* Current Read */}
          {club.current_read && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <BookOpen className="h-4 w-4 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">Currently reading</p>
                <p className="text-sm font-medium truncate">
                  {club.current_read.book.title}
                </p>
              </div>
              <CoverImageMini
                book={{
                  title: club.current_read.book.title,
                  cover_url: club.current_read.book.cover_url,
                }}
                className="w-8 h-12 shrink-0"
              />
            </div>
          )}

          {/* Creator */}
          {club.creator && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <Avatar className="h-5 w-5">
                <AvatarImage src={club.creator.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {(club.creator.display_name || club.creator.username)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground">
                Created by {club.creator.display_name || club.creator.username}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
