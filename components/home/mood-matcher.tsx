"use client";

import { useState } from "react";
import { Sparkles, Search, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIBookSearch } from "@/components/ai/ai-book-search";
import { cn } from "@/lib/utils";

const MOOD_PILLS = [
  { label: "Something cozy", query: "a cozy, comforting read perfect for a rainy day" },
  { label: "Mind-bending", query: "a mind-bending book with twists and philosophical themes" },
  { label: "Page-turner", query: "a fast-paced page-turner I can't put down" },
  { label: "Tear-jerker", query: "an emotional book that will make me cry" },
  { label: "Light & funny", query: "a light, funny book to lift my spirits" },
  { label: "Epic adventure", query: "an epic adventure with great world-building" },
];

export function MoodMatcher() {
  const [showAISearch, setShowAISearch] = useState(false);
  const [selectedMood, setSelectedMood] = useState<string | null>(null);
  const [customQuery, setCustomQuery] = useState("");

  const handleMoodClick = (mood: typeof MOOD_PILLS[0]) => {
    setSelectedMood(mood.query);
    setShowAISearch(true);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (customQuery.trim()) {
      setSelectedMood(customQuery.trim());
      setShowAISearch(true);
    }
  };

  return (
    <>
      <div className="bg-gradient-to-br from-primary/5 via-background to-accent/5 rounded-xl border border-border/50 p-4 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">What are you in the mood for?</h3>
            <p className="text-xs text-muted-foreground">Find your next favorite read</p>
          </div>
        </div>

        {/* Mood Pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          {MOOD_PILLS.map((mood) => (
            <button
              key={mood.label}
              onClick={() => handleMoodClick(mood)}
              className={cn(
                "px-3 py-1.5 text-xs rounded-full",
                "bg-muted hover:bg-primary hover:text-primary-foreground",
                "border border-border/50 hover:border-primary",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary/50"
              )}
            >
              {mood.label}
            </button>
          ))}
        </div>

        {/* Custom Search Input */}
        <form onSubmit={handleCustomSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={customQuery}
              onChange={(e) => setCustomQuery(e.target.value)}
              placeholder="Or describe what you want..."
              className={cn(
                "w-full pl-9 pr-4 py-2 text-sm rounded-lg",
                "bg-background border border-border",
                "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
                "placeholder:text-muted-foreground"
              )}
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={!customQuery.trim()}
            className="px-4"
          >
            <Sparkles className="w-4 h-4 mr-1.5" />
            Find
          </Button>
        </form>
      </div>

      {/* AI Search Dialog */}
      <AIBookSearch
        open={showAISearch}
        onOpenChange={(open) => {
          setShowAISearch(open);
          if (!open) {
            setSelectedMood(null);
            setCustomQuery("");
          }
        }}
        initialQuery={selectedMood || undefined}
      />
    </>
  );
}
