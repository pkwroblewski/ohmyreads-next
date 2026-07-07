import { z } from "zod";

const locationLabelSchema = z
  .string()
  .min(1, "Invalid location label")
  .max(200, "Invalid location label");

const precisionSchema = z.number().int("Invalid precision").optional();

export const updateLocationSchema = z.object({
  lat: z
    .number()
    .min(-90, "Invalid coordinates")
    .max(90, "Invalid coordinates"),
  lng: z
    .number()
    .min(-180, "Invalid coordinates")
    .max(180, "Invalid coordinates"),
  label: locationLabelSchema,
  precision: precisionSchema,
});

export const updateLocationFromGeohashSchema = z.object({
  geohash: z.string().min(1, "Invalid geohash").max(12, "Invalid geohash"),
  label: locationLabelSchema,
  precision: precisionSchema,
});

export const locationEnabledSchema = z.boolean();

export const locationPrecisionSchema = z.number().int("Invalid precision");

export const setPresenceSchema = z.object({
  type: z.enum(["temporary", "recommended"]),
  durationHours: z.number().int("Invalid duration").optional(),
  note: z
    .string()
    .max(140, "Note must be 140 characters or less")
    .optional(),
  placeName: z.string().max(200, "Invalid place name").optional(),
  placeGeohash: z.string().max(12, "Invalid geohash").optional(),
});

export type UpdateLocationValidatedInput = z.infer<typeof updateLocationSchema>;
export type SetPresenceValidatedInput = z.infer<typeof setPresenceSchema>;
