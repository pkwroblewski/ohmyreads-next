import { z } from "zod";

export const submitPlaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Name must be between 2 and 200 characters")
    .max(200, "Name must be between 2 and 200 characters"),
  placeType: z.enum([
    "bookstore",
    "library",
    "cafe",
    "bookclub",
    "popup",
    "other",
  ]),
  address: z.string().trim().max(200, "Invalid address").optional(),
  city: z.string().trim().max(100, "Invalid city").optional(),
  country: z.string().trim().max(100, "Invalid country").optional(),
  lat: z
    .number()
    .min(-90, "Invalid coordinates")
    .max(90, "Invalid coordinates")
    .optional(),
  lng: z
    .number()
    .min(-180, "Invalid coordinates")
    .max(180, "Invalid coordinates")
    .optional(),
  website: z.string().trim().max(500, "Invalid website").optional(),
  description: z
    .string()
    .trim()
    .max(2000, "Description must be less than 2000 characters")
    .optional(),
});

/**
 * Atmosphere tags a reader can attach to a place review.
 * Mirrors the options rendered by `components/geo/place-review-form.tsx`.
 */
export const PLACE_ATMOSPHERE_TAGS = [
  "cozy",
  "quiet",
  "busy",
  "well-lit",
  "good-coffee",
  "great-selection",
  "helpful-staff",
  "good-for-reading",
  "power-outlets",
  "wifi",
  "outdoor-seating",
  "pet-friendly",
] as const;

export const placeReviewSchema = z.object({
  rating: z
    .number()
    .int("Rating must be a number between 1 and 5")
    .min(1, "Rating must be a number between 1 and 5")
    .max(5, "Rating must be a number between 1 and 5"),
  content: z
    .string()
    .trim()
    .max(2000, "Review must be less than 2000 characters")
    .nullable()
    .optional(),
  atmosphereTags: z
    .array(z.enum(PLACE_ATMOSPHERE_TAGS))
    .max(PLACE_ATMOSPHERE_TAGS.length, "Too many tags")
    .optional(),
});

export const placeModerationSchema = z.object({
  submissionId: z.string().uuid("Invalid submission ID"),
  notes: z.string().max(2000, "Notes must be less than 2000 characters").optional(),
});

export type PlaceReviewInput = z.infer<typeof placeReviewSchema>;
export type SubmitPlaceValidatedInput = z.infer<typeof submitPlaceSchema>;
export type PlaceModerationInput = z.infer<typeof placeModerationSchema>;
