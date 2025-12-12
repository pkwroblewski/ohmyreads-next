"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, X, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { updateTasteProfile } from "@/lib/actions/taste";
import {
  VIBE_TAGS,
  type UserTasteProfile,
  type PacePreference,
  type LengthPreference,
  type VibeTag,
} from "@/types/database";

interface TasteProfileSectionProps {
  initialProfile: UserTasteProfile | null;
  availableGenres: string[];
}

export function TasteProfileSection({
  initialProfile,
  availableGenres,
}: TasteProfileSectionProps) {
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  // State for preferences
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    initialProfile?.preferred_genres || []
  );
  const [selectedVibes, setSelectedVibes] = useState<string[]>(
    initialProfile?.preferred_vibes || []
  );
  const [pace, setPace] = useState<PacePreference | null>(
    initialProfile?.preferred_pace || null
  );
  const [length, setLength] = useState<LengthPreference | null>(
    initialProfile?.preferred_length || null
  );

  // UI State
  const [showAllGenres, setShowAllGenres] = useState(false);
  const [showVibes, setShowVibes] = useState(selectedVibes.length > 0);

  const displayedGenres = showAllGenres
    ? availableGenres
    : availableGenres.slice(0, 12);

  const toggleGenre = (genre: string) => {
    setHasChanges(true);
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else if (selectedGenres.length < 20) {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const toggleVibe = (vibe: string) => {
    setHasChanges(true);
    if (selectedVibes.includes(vibe)) {
      setSelectedVibes(selectedVibes.filter((v) => v !== vibe));
    } else if (selectedVibes.length < 15) {
      setSelectedVibes([...selectedVibes, vibe]);
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateTasteProfile({
        preferredGenres: selectedGenres,
        preferredVibes: selectedVibes as VibeTag[],
        preferredPace: pace,
        preferredLength: length,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Taste profile updated!");
        setHasChanges(false);
      }
    });
  };

  const handleReset = () => {
    setSelectedGenres(initialProfile?.preferred_genres || []);
    setSelectedVibes(initialProfile?.preferred_vibes || []);
    setPace(initialProfile?.preferred_pace || null);
    setLength(initialProfile?.preferred_length || null);
    setHasChanges(false);
  };

  return (
    <div className="space-y-8">
      {/* Genre Preferences */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Favorite Genres</h3>
            <p className="text-sm text-muted-foreground">
              Select genres you enjoy reading ({selectedGenres.length}/20)
            </p>
          </div>
          {selectedGenres.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSelectedGenres([]);
                setHasChanges(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Selected Genres */}
        {selectedGenres.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedGenres.map((genre) => (
              <span
                key={genre}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium bg-primary text-primary-foreground"
              >
                {genre}
                <button
                  type="button"
                  onClick={() => toggleGenre(genre)}
                  className="hover:opacity-70"
                  aria-label={`Remove ${genre}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Genre Selection */}
        <div className="flex flex-wrap gap-2">
          {displayedGenres.map((genre) => (
            <button
              key={genre}
              type="button"
              onClick={() => toggleGenre(genre)}
              disabled={
                selectedGenres.length >= 20 && !selectedGenres.includes(genre)
              }
              className={cn(
                "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                selectedGenres.includes(genre)
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground",
                selectedGenres.length >= 20 &&
                  !selectedGenres.includes(genre) &&
                  "opacity-50 cursor-not-allowed"
              )}
            >
              {selectedGenres.includes(genre) && (
                <Check className="h-3 w-3 inline mr-1" />
              )}
              {genre}
            </button>
          ))}
        </div>

        {availableGenres.length > 12 && (
          <button
            type="button"
            onClick={() => setShowAllGenres(!showAllGenres)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {showAllGenres ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Show fewer genres
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show all {availableGenres.length} genres
              </>
            )}
          </button>
        )}
      </div>

      {/* Vibe Preferences */}
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setShowVibes(!showVibes)}
          className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
        >
          {showVibes ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
          {showVibes ? "Hide" : "Show"} vibe preferences ({selectedVibes.length}
          /15)
        </button>

        {showVibes && (
          <div className="space-y-4 p-4 rounded-lg border border-input bg-muted/30">
            <p className="text-sm text-muted-foreground">
              What vibes do you look for in books?
            </p>

            {/* Emotional Tone */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Emotional Tone
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.emotional.map((tag) => (
                  <VibeButton
                    key={tag}
                    tag={tag}
                    isSelected={selectedVibes.includes(tag)}
                    onToggle={() => toggleVibe(tag)}
                    disabled={
                      selectedVibes.length >= 15 && !selectedVibes.includes(tag)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Style */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Pacing & Style
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.style.map((tag) => (
                  <VibeButton
                    key={tag}
                    tag={tag}
                    isSelected={selectedVibes.includes(tag)}
                    onToggle={() => toggleVibe(tag)}
                    disabled={
                      selectedVibes.length >= 15 && !selectedVibes.includes(tag)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Character */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Focus
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.character.map((tag) => (
                  <VibeButton
                    key={tag}
                    tag={tag}
                    isSelected={selectedVibes.includes(tag)}
                    onToggle={() => toggleVibe(tag)}
                    disabled={
                      selectedVibes.length >= 15 && !selectedVibes.includes(tag)
                    }
                  />
                ))}
              </div>
            </div>

            {/* Experience */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Reading Experience
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VIBE_TAGS.experience.map((tag) => (
                  <VibeButton
                    key={tag}
                    tag={tag}
                    isSelected={selectedVibes.includes(tag)}
                    onToggle={() => toggleVibe(tag)}
                    disabled={
                      selectedVibes.length >= 15 && !selectedVibes.includes(tag)
                    }
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Pace Preference */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium">Reading Pace Preference</h3>
          <p className="text-sm text-muted-foreground">
            What pace do you prefer in books?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["slow", "medium", "fast"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setPace(pace === option ? null : option);
                setHasChanges(true);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                pace === option
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-input"
              )}
            >
              {option === "slow" && "🐢 Slow & Contemplative"}
              {option === "medium" && "🚶 Balanced Pace"}
              {option === "fast" && "🚀 Fast-Paced & Thrilling"}
            </button>
          ))}
        </div>
      </div>

      {/* Length Preference */}
      <div className="space-y-3">
        <div>
          <h3 className="font-medium">Book Length Preference</h3>
          <p className="text-sm text-muted-foreground">
            How long do you like your books?
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(["short", "medium", "long"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => {
                setLength(length === option ? null : option);
                setHasChanges(true);
              }}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors border",
                length === option
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-input"
              )}
            >
              {option === "short" && "📖 Short (<250 pages)"}
              {option === "medium" && "📚 Medium (250-500 pages)"}
              {option === "long" && "📕 Long (500+ pages)"}
            </button>
          ))}
        </div>
      </div>

      {/* Save/Reset Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t">
        <Button onClick={handleSave} disabled={!hasChanges || isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              Save Preferences
            </>
          )}
        </Button>
        {hasChanges && (
          <Button variant="outline" onClick={handleReset} disabled={isPending}>
            Reset Changes
          </Button>
        )}
        {!hasChanges && initialProfile && (
          <p className="text-sm text-muted-foreground">
            ✓ Your preferences are saved
          </p>
        )}
      </div>
    </div>
  );
}

// Helper component for vibe buttons
function VibeButton({
  tag,
  isSelected,
  onToggle,
  disabled,
}: {
  tag: string;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
        isSelected
          ? "bg-primary text-primary-foreground"
          : "bg-muted hover:bg-muted/80 text-muted-foreground",
        disabled && !isSelected && "opacity-50 cursor-not-allowed"
      )}
    >
      {tag.replace("-", " ")}
    </button>
  );
}

