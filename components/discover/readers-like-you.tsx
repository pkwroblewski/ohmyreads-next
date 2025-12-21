"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ReaderCard } from "./reader-card";
import type { ReaderWithCompatibility } from "@/types/database";

interface ReadersLikeYouProps {
  readers: ReaderWithCompatibility[];
}

export function ReadersLikeYou({ readers }: ReadersLikeYouProps) {
  if (readers.length === 0) {
    return null;
  }

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-semibold">Readers Like You</h2>
        </div>
        <Link
          href="/discover?sort=compatibility"
          className="text-sm text-primary hover:underline"
        >
          See all
        </Link>
      </div>

      <p className="text-muted-foreground text-sm mb-4">
        Based on your reading history, reviews, and taste preferences
      </p>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {readers.map((reader) => (
          <ReaderCard key={reader.id} reader={reader} showCompatibility />
        ))}
      </div>
    </section>
  );
}
