"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  BookOpen,
  Heart,
  ArrowRight,
  ArrowLeft,
  Check,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { completeTasteOnboarding } from "@/lib/actions/taste";
import {
  VIBE_TAGS,
  type UserTasteProfile,
  type VibeTag,
  type PacePreference,
  type LengthPreference,
} from "@/types/database";

interface TasteOnboardingWizardProps {
  availableGenres: string[];
  existingProfile: UserTasteProfile | null;
}

type Step = "genres" | "vibes" | "pace" | "complete";

const STEPS: Step[] = ["genres", "vibes", "pace", "complete"];

export function TasteOnboardingWizard({
  availableGenres,
  existingProfile,
}: TasteOnboardingWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<Step>("genres");

  // Form state
  const [selectedGenres, setSelectedGenres] = useState<string[]>(
    existingProfile?.preferred_genres || []
  );
  const [selectedVibes, setSelectedVibes] = useState<string[]>(
    existingProfile?.preferred_vibes || []
  );
  const [pace, setPace] = useState<PacePreference | null>(
    existingProfile?.preferred_pace || null
  );
  const [length, setLength] = useState<LengthPreference | null>(
    existingProfile?.preferred_length || null
  );

  const currentStepIndex = STEPS.indexOf(currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  const canProceed = () => {
    switch (currentStep) {
      case "genres":
        return selectedGenres.length >= 1;
      case "vibes":
        return true; // Optional
      case "pace":
        return true; // Optional
      case "complete":
        return true;
      default:
        return false;
    }
  };

  const goToNextStep = () => {
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < STEPS.length) {
      setCurrentStep(STEPS[nextIndex]);
    }
  };

  const goToPreviousStep = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(STEPS[prevIndex]);
    }
  };

  const handleComplete = () => {
    startTransition(async () => {
      const result = await completeTasteOnboarding({
        preferredGenres: selectedGenres,
        preferredVibes: selectedVibes as VibeTag[],
        preferredPace: pace,
        preferredLength: length,
        seedBookIds: [], // We're not collecting seed books in this simplified flow
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Taste profile saved! Enjoy your personalized recommendations.");
        router.push("/dashboard");
      }
    });
  };

  const toggleGenre = (genre: string) => {
    if (selectedGenres.includes(genre)) {
      setSelectedGenres(selectedGenres.filter((g) => g !== genre));
    } else if (selectedGenres.length < 20) {
      setSelectedGenres([...selectedGenres, genre]);
    }
  };

  const toggleVibe = (vibe: string) => {
    if (selectedVibes.includes(vibe)) {
      setSelectedVibes(selectedVibes.filter((v) => v !== vibe));
    } else if (selectedVibes.length < 15) {
      setSelectedVibes([...selectedVibes, vibe]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-muted-foreground mt-2 text-center">
          Step {currentStepIndex + 1} of {STEPS.length}
        </p>
      </div>

      {/* Content Card */}
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-lg">
        {/* Step 1: Genres */}
        {currentStep === "genres" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">What do you love to read?</h2>
              <p className="text-muted-foreground">
                Select your favorite genres. This helps us recommend books you&apos;ll enjoy.
              </p>
            </div>

            {/* Selected count */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedGenres.length} genre{selectedGenres.length !== 1 ? "s" : ""} selected
              </span>
              {selectedGenres.length > 0 && (
                <button
                  onClick={() => setSelectedGenres([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Genre Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {availableGenres.map((genre) => (
                <button
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  disabled={
                    selectedGenres.length >= 20 && !selectedGenres.includes(genre)
                  }
                  className={cn(
                    "p-3 rounded-lg text-sm font-medium transition-all",
                    "border-2",
                    selectedGenres.includes(genre)
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background hover:bg-muted border-border",
                    selectedGenres.length >= 20 &&
                      !selectedGenres.includes(genre) &&
                      "opacity-50 cursor-not-allowed"
                  )}
                >
                  {selectedGenres.includes(genre) && (
                    <Check className="h-4 w-4 inline mr-1.5" />
                  )}
                  {genre}
                </button>
              ))}
            </div>

            {selectedGenres.length === 0 && (
              <p className="text-center text-sm text-amber-600 dark:text-amber-400">
                Please select at least one genre to continue
              </p>
            )}
          </div>
        )}

        {/* Step 2: Vibes */}
        {currentStep === "vibes" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-pink-500/10 flex items-center justify-center mx-auto mb-4">
                <Heart className="h-8 w-8 text-pink-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">What vibes do you enjoy?</h2>
              <p className="text-muted-foreground">
                Optional: Select the moods and styles you look for in books.
              </p>
            </div>

            {/* Selected vibes display */}
            {selectedVibes.length > 0 && (
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedVibes.map((vibe) => (
                  <span
                    key={vibe}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary text-primary-foreground"
                  >
                    {vibe.replace("-", " ")}
                    <button
                      onClick={() => toggleVibe(vibe)}
                      className="hover:opacity-70"
                      aria-label={`Remove ${vibe.replace("-", " ")}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Vibe Categories */}
            <div className="space-y-4">
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
                      disabled={selectedVibes.length >= 15 && !selectedVibes.includes(tag)}
                    />
                  ))}
                </div>
              </div>

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
                      disabled={selectedVibes.length >= 15 && !selectedVibes.includes(tag)}
                    />
                  ))}
                </div>
              </div>

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
                      disabled={selectedVibes.length >= 15 && !selectedVibes.includes(tag)}
                    />
                  ))}
                </div>
              </div>

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
                      disabled={selectedVibes.length >= 15 && !selectedVibes.includes(tag)}
                    />
                  ))}
                </div>
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              {selectedVibes.length}/15 vibes selected (optional)
            </p>
          </div>
        )}

        {/* Step 3: Pace & Length */}
        {currentStep === "pace" && (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-blue-500/10 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-8 w-8 text-blue-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Reading preferences</h2>
              <p className="text-muted-foreground">
                Optional: Tell us about your reading style preferences.
              </p>
            </div>

            {/* Pace Selection */}
            <div className="space-y-3">
              <h3 className="font-medium text-center">Preferred reading pace</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["slow", "medium", "fast"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setPace(pace === option ? null : option)}
                    className={cn(
                      "p-4 rounded-xl text-center transition-all",
                      "border-2",
                      pace === option
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <div className="text-2xl mb-1">
                      {option === "slow" && <span role="img" aria-label="Turtle">🐢</span>}
                      {option === "medium" && <span role="img" aria-label="Walking">🚶</span>}
                      {option === "fast" && <span role="img" aria-label="Rocket">🚀</span>}
                    </div>
                    <div className="font-medium text-sm">
                      {option === "slow" && "Slow & Contemplative"}
                      {option === "medium" && "Balanced Pace"}
                      {option === "fast" && "Fast-Paced"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Length Selection */}
            <div className="space-y-3">
              <h3 className="font-medium text-center">Preferred book length</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {(["short", "medium", "long"] as const).map((option) => (
                  <button
                    key={option}
                    onClick={() => setLength(length === option ? null : option)}
                    className={cn(
                      "p-4 rounded-xl text-center transition-all",
                      "border-2",
                      length === option
                        ? "bg-primary/10 border-primary text-primary"
                        : "bg-background hover:bg-muted border-border"
                    )}
                  >
                    <div className="text-2xl mb-1">
                      {option === "short" && <span role="img" aria-label="Open book">📖</span>}
                      {option === "medium" && <span role="img" aria-label="Books">📚</span>}
                      {option === "long" && <span role="img" aria-label="Closed book">📕</span>}
                    </div>
                    <div className="font-medium text-sm">
                      {option === "short" && "Short (<250 pages)"}
                      {option === "medium" && "Medium (250-500)"}
                      {option === "long" && "Long (500+)"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-center text-sm text-muted-foreground">
              These are optional. You can skip or change them later in Settings.
            </p>
          </div>
        )}

        {/* Step 4: Complete */}
        {currentStep === "complete" && (
          <div className="space-y-6 text-center">
            <div className="w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <Check className="h-10 w-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold mb-2">You&apos;re all set!</h2>
              <p className="text-muted-foreground">
                We&apos;ll use your preferences to recommend books you&apos;ll love.
              </p>
            </div>

            {/* Summary */}
            <div className="text-left p-4 rounded-lg bg-muted/50 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Genres:</span>
                <span className="font-medium">
                  {selectedGenres.length > 0
                    ? selectedGenres.slice(0, 3).join(", ") +
                      (selectedGenres.length > 3 ? ` +${selectedGenres.length - 3} more` : "")
                    : "None selected"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vibes:</span>
                <span className="font-medium">
                  {selectedVibes.length > 0
                    ? selectedVibes.slice(0, 3).join(", ").replace(/-/g, " ") +
                      (selectedVibes.length > 3 ? ` +${selectedVibes.length - 3} more` : "")
                    : "None selected"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pace:</span>
                <span className="font-medium">{pace || "No preference"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Length:</span>
                <span className="font-medium">{length || "No preference"}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              You can always update your preferences in Settings.
            </p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t">
          <Button
            variant="ghost"
            onClick={goToPreviousStep}
            disabled={currentStepIndex === 0}
            className={cn(currentStepIndex === 0 && "invisible")}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentStep === "complete" ? (
            <Button onClick={handleComplete} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={goToNextStep} disabled={!canProceed()}>
              {currentStep === "pace" ? "Review" : "Continue"}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>

      {/* Skip Link */}
      <div className="text-center mt-4">
        <button
          onClick={() => router.push("/dashboard")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Skip for now
        </button>
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
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium transition-all",
        isSelected
          ? "bg-primary text-primary-foreground scale-105"
          : "bg-muted hover:bg-muted/80 text-muted-foreground",
        disabled && !isSelected && "opacity-50 cursor-not-allowed"
      )}
    >
      {tag.replace("-", " ")}
    </button>
  );
}

