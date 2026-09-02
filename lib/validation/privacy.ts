import { z } from "zod";

export const discoveryVisibilitySchema = z.boolean();

/** Email preferences a user can set for themselves (settings → Email). */
export const emailPreferencesSchema = z
  .object({
    digestEnabled: z.boolean().optional(),
  })
  .refine((v) => v.digestEnabled !== undefined, {
    message: "Nothing to update",
  });

export type EmailPreferencesInput = z.infer<typeof emailPreferencesSchema>;
