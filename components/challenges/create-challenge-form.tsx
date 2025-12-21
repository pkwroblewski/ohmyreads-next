"use client";

import { useState, useTransition } from "react";
import { Plus, BookOpen, FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createChallenge } from "@/lib/actions/challenges";
import type { ChallengeType } from "@/types/database";
import { cn } from "@/lib/utils";

const GENRES = [
  "Fiction",
  "Non-Fiction",
  "Fantasy",
  "Science Fiction",
  "Mystery",
  "Romance",
  "Thriller",
  "Horror",
  "Biography",
  "Self-Help",
  "History",
  "Philosophy",
];

const challengeTypes: {
  type: ChallengeType;
  label: string;
  description: string;
  icon: typeof BookOpen;
  color: string;
}[] = [
  {
    type: "books_count",
    label: "Books",
    description: "Read a number of books",
    icon: BookOpen,
    color: "from-blue-500 to-indigo-500",
  },
  {
    type: "pages_count",
    label: "Pages",
    description: "Read a number of pages",
    icon: FileText,
    color: "from-purple-500 to-pink-500",
  },
  {
    type: "genre_books",
    label: "Genre",
    description: "Read books in a specific genre",
    icon: Sparkles,
    color: "from-amber-500 to-orange-500",
  },
];

interface CreateChallengeFormProps {
  onSuccess?: () => void;
}

export default function CreateChallengeForm({
  onSuccess,
}: CreateChallengeFormProps) {
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [challengeType, setChallengeType] =
    useState<ChallengeType>("books_count");
  const [targetValue, setTargetValue] = useState("5");
  const [genre, setGenre] = useState("");
  const [duration, setDuration] = useState<"month" | "year" | "custom">(
    "month"
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const getDateRange = () => {
    const today = new Date();
    if (duration === "month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    } else if (duration === "year") {
      const start = new Date(today.getFullYear(), 0, 1);
      const end = new Date(today.getFullYear(), 11, 31);
      return {
        start: start.toISOString().split("T")[0],
        end: end.toISOString().split("T")[0],
      };
    }
    return { start: startDate, end: endDate };
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setChallengeType("books_count");
    setTargetValue("5");
    setGenre("");
    setDuration("month");
    setStartDate("");
    setEndDate("");
    setIsExpanded(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { start, end } = getDateRange();

    if (!name.trim()) {
      toast.error("Please enter a challenge name");
      return;
    }

    if (challengeType === "genre_books" && !genre) {
      toast.error("Please select a genre");
      return;
    }

    if (duration === "custom" && (!startDate || !endDate)) {
      toast.error("Please set start and end dates");
      return;
    }

    startTransition(async () => {
      const result = await createChallenge({
        name: name.trim(),
        description: description.trim() || undefined,
        challenge_type: challengeType,
        target_value: parseInt(targetValue),
        genre: challengeType === "genre_books" ? genre : undefined,
        start_date: start,
        end_date: end,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Challenge created!");
        resetForm();
        onSuccess?.();
      }
    });
  };

  if (!isExpanded) {
    return (
      <Button
        onClick={() => setIsExpanded(true)}
        className="w-full"
        variant="outline"
      >
        <Plus className="h-4 w-4 mr-2" />
        Create New Challenge
      </Button>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Challenge Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Challenge Name</Label>
            <Input
              id="name"
              placeholder="e.g., December Reading Sprint"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input
              id="description"
              placeholder="What's this challenge about?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Challenge Type */}
          <div className="space-y-2">
            <Label>Challenge Type</Label>
            <div className="grid grid-cols-3 gap-3">
              {challengeTypes.map((type) => {
                const Icon = type.icon;
                const isSelected = challengeType === type.type;
                return (
                  <button
                    key={type.type}
                    type="button"
                    onClick={() => setChallengeType(type.type)}
                    className={cn(
                      "p-3 rounded-lg border-2 transition-all text-left",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-muted hover:border-muted-foreground/30"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center mb-2",
                        "bg-gradient-to-br",
                        type.color
                      )}
                    >
                      <Icon className="h-4 w-4 text-white" />
                    </div>
                    <p className="font-medium text-sm">{type.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {type.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target Value */}
          <div className="space-y-2">
            <Label htmlFor="target">
              Target{" "}
              {challengeType === "pages_count" ? "Pages" : "Books"}
            </Label>
            <Input
              id="target"
              type="number"
              min={1}
              max={10000}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              required
            />
          </div>

          {/* Genre Selection (for genre_books type) */}
          {challengeType === "genre_books" && (
            <div className="space-y-2">
              <Label>Genre</Label>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGenre(g)}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm border transition-colors",
                      genre === g
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted hover:bg-muted/80 border-transparent"
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <div className="flex gap-2">
              {(["month", "year", "custom"] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDuration(d)}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                    duration === d
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-muted/80 border-transparent"
                  )}
                >
                  {d === "month"
                    ? "This Month"
                    : d === "year"
                    ? "This Year"
                    : "Custom"}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Range */}
          {duration === "custom" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isPending} className="flex-1">
              {isPending ? "Creating..." : "Create Challenge"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetForm}
              disabled={isPending}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
