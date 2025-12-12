"use client";

import Image from "next/image";
import Link from "next/link";
import { BookOpen, Calendar, Ruler, Star, Trophy, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ReadingStats } from "@/lib/queries/stats";

interface StatsHighlightsProps {
  stats: ReadingStats;
}

export default function StatsHighlights({ stats }: StatsHighlightsProps) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Reading Highlights</h2>

      {/* Book Highlights Grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.longestBook && (
          <HighlightCard
            icon={Ruler}
            title="Longest Book"
            book={stats.longestBook}
            stat={`${stats.longestBook.pages.toLocaleString()} pages`}
            gradient="from-violet-500 to-purple-600"
          />
        )}

        {stats.shortestBook && (
          <HighlightCard
            icon={Zap}
            title="Shortest Book"
            book={stats.shortestBook}
            stat={`${stats.shortestBook.pages.toLocaleString()} pages`}
            gradient="from-cyan-500 to-teal-600"
          />
        )}

        {stats.oldestBook && (
          <HighlightCard
            icon={Calendar}
            title="Oldest Book"
            book={stats.oldestBook}
            stat={`Published ${stats.oldestBook.year}`}
            gradient="from-amber-500 to-orange-600"
          />
        )}

        {stats.highestRated && (
          <HighlightCard
            icon={Star}
            title="Your Top Rated"
            book={stats.highestRated}
            stat={`${stats.highestRated.rating} stars`}
            gradient="from-pink-500 to-rose-600"
          />
        )}
      </div>

      {/* Fun Facts */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.fastestBook && (
          <FunFactCard
            emoji="⚡"
            title="Speed Reader"
            description={`You finished "${stats.fastestBook.title}" in just ${stats.fastestBook.days} ${stats.fastestBook.days === 1 ? "day" : "days"}!`}
          />
        )}

        {stats.slowestBook && stats.slowestBook.days > 30 && (
          <FunFactCard
            emoji="🐢"
            title="Slow & Steady"
            description={`"${stats.slowestBook.title}" was a ${stats.slowestBook.days}-day journey. Worth every page!`}
          />
        )}

        {stats.totalPagesRead > 10000 && (
          <FunFactCard
            emoji="📚"
            title="Page Turner"
            description={`You've read ${stats.totalPagesRead.toLocaleString()} pages. That's about ${Math.round(stats.totalPagesRead / 300)} average-sized books!`}
          />
        )}

        {stats.topAuthors[0]?.count >= 3 && (
          <FunFactCard
            emoji="❤️"
            title="Loyal Fan"
            description={`You've read ${stats.topAuthors[0].count} books by ${stats.topAuthors[0].author}. Clearly a favorite!`}
          />
        )}

        {stats.averageRating >= 4 && (
          <FunFactCard
            emoji="⭐"
            title="Generous Reviewer"
            description={`Your average rating is ${stats.averageRating.toFixed(1)} stars. You know how to pick great books!`}
          />
        )}

        {stats.genreDistribution[0] && (
          <FunFactCard
            emoji="🎯"
            title="Genre Focus"
            description={`${stats.genreDistribution[0].percentage}% of your books are ${stats.genreDistribution[0].genre}. You know what you like!`}
          />
        )}
      </div>

      {/* Share Card */}
      <Card className="bg-gradient-to-br from-violet-600 to-cyan-500 text-white border-0">
        <CardContent className="py-8 text-center">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h3 className="text-xl font-bold mb-2">Share Your Reading Stats!</h3>
          <p className="text-white/80 mb-4 max-w-md mx-auto">
            Show off your reading achievements to friends and fellow book
            lovers.
          </p>
          <button className="bg-white text-violet-600 px-6 py-2 rounded-full font-medium hover:bg-white/90 transition-colors">
            Coming Soon
          </button>
        </CardContent>
      </Card>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  title,
  book,
  stat,
  gradient,
}: {
  icon: React.ElementType;
  title: string;
  book: { title: string; slug: string; cover_url: string | null };
  stat: string;
  gradient: string;
}) {
  return (
    <Link href={`/books/${book.slug}`}>
      <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
        <div className={`bg-gradient-to-br ${gradient} p-4`}>
          <div className="flex items-center gap-2 text-white mb-2">
            <Icon className="h-4 w-4" />
            <span className="text-sm font-medium">{title}</span>
          </div>
          <div className="text-white/80 text-xs">{stat}</div>
        </div>
        <CardContent className="p-4">
          <div className="flex gap-3">
            {book.cover_url ? (
              <Image
                src={book.cover_url}
                alt={book.title}
                width={48}
                height={72}
                className="rounded shadow-sm object-cover"
              />
            ) : (
              <div className="w-12 h-[72px] bg-muted rounded flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm line-clamp-2 group-hover:text-primary transition-colors">
                {book.title}
              </h4>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function FunFactCard({
  emoji,
  title,
  description,
}: {
  emoji: string;
  title: string;
  description: string;
}) {
  return (
    <Card className="bg-muted/50">
      <CardContent className="p-4">
        <div className="flex gap-3">
          <div className="text-2xl">{emoji}</div>
          <div>
            <h4 className="font-medium mb-1">{title}</h4>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

