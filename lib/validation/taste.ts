import { z } from "zod";
import { ALL_VIBE_TAGS } from "@/types/database";

// Vibe tag schema
const vibeTagSchema = z.enum(ALL_VIBE_TAGS as unknown as [string, ...string[]]);

// Pace preference schema
const paceSchema = z.enum(["slow", "medium", "fast"]);

// Length preference schema
const lengthSchema = z.enum(["short", "medium", "long"]);

// Schema for updating taste profile
export const updateTasteProfileSchema = z.object({
  preferredGenres: z
    .array(z.string().min(1).max(50))
    .max(20, "Maximum 20 genres allowed")
    .default([]),
  preferredVibes: z
    .array(vibeTagSchema)
    .max(15, "Maximum 15 vibe tags allowed")
    .default([]),
  preferredPace: paceSchema.nullable().default(null),
  preferredLength: lengthSchema.nullable().default(null),
});

// Schema for onboarding taste profile (includes seed books)
export const onboardingTasteProfileSchema = z.object({
  preferredGenres: z
    .array(z.string().min(1).max(50))
    .min(1, "Select at least one genre")
    .max(20, "Maximum 20 genres allowed"),
  preferredVibes: z
    .array(vibeTagSchema)
    .max(15, "Maximum 15 vibe tags allowed")
    .default([]),
  preferredPace: paceSchema.nullable().default(null),
  preferredLength: lengthSchema.nullable().default(null),
  seedBookIds: z
    .array(z.string().uuid("Invalid book ID"))
    .max(10, "Maximum 10 seed books allowed")
    .default([]),
});

export type UpdateTasteProfileInput = z.infer<typeof updateTasteProfileSchema>;
export type OnboardingTasteProfileInput = z.infer<typeof onboardingTasteProfileSchema>;

