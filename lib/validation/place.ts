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

export const placeModerationSchema = z.object({
  submissionId: z.string().uuid("Invalid submission ID"),
  notes: z.string().max(2000, "Notes must be less than 2000 characters").optional(),
});

export type SubmitPlaceValidatedInput = z.infer<typeof submitPlaceSchema>;
export type PlaceModerationInput = z.infer<typeof placeModerationSchema>;
