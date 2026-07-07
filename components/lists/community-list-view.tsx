import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  ListBookManager,
  ListLikeButton,
} from "@/components/lists/list-book-manager";
import type { ReadingListWithDetails } from "@/types/database";

interface CommunityListViewProps {
  list: ReadingListWithDetails;
  isOwner: boolean;
}

export function CommunityListView({ list, isOwner }: CommunityListViewProps) {
  return (
    <div className="container max-w-6xl py-8">
      {/* Breadcrumb */}
      <nav className="mb-6">
        <Link
          href="/lists"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          All Lists
        </Link>
      </nav>

      {/* Header */}
      <header className="mb-10">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 mb-4">
            <h1 className="text-3xl md:text-4xl font-bold font-serif">
              {list.title}
            </h1>
            {list.visibility === "private" && (
              <Badge variant="outline">Private</Badge>
            )}
          </div>
          {!isOwner && (
            <ListLikeButton
              listId={list.id}
              isLiked={list.is_liked ?? false}
              likesCount={list.likes_count ?? 0}
            />
          )}
        </div>
        {list.description && (
          <p className="text-lg text-muted-foreground max-w-3xl">
            {list.description}
          </p>
        )}
        <div className="flex items-center gap-4 mt-4 text-sm text-muted-foreground">
          {list.owner && (
            <Link
              href={`/users/${list.owner.username}`}
              className="flex items-center gap-2 hover:text-foreground transition-colors"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={list.owner.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">
                  {(list.owner.display_name || list.owner.username)?.[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>By {list.owner.display_name || list.owner.username}</span>
            </Link>
          )}
          <span className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            {list.book_count} {list.book_count === 1 ? "book" : "books"}
          </span>
        </div>
      </header>

      {/* Books */}
      {isOwner ? (
        <ListBookManager listId={list.id} books={list.books} />
      ) : list.books.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6">
          {list.books.map((item) => (
            <Link
              key={item.book_id}
              href={`/books/${item.book.slug}`}
              className="group"
            >
              <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted mb-2">
                {item.book.cover_url ? (
                  <Image
                    src={item.book.cover_url}
                    alt={item.book.title}
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                    className="object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <BookOpen className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
              <h3 className="text-sm font-medium line-clamp-2 group-hover:text-primary transition-colors">
                {item.book.title}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {item.book.author}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No books in this list yet.</p>
        </div>
      )}
    </div>
  );
}
