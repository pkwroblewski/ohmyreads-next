import { z } from "zod";

export const updateProfileSchema = z.object({
  displayName: z.string().max(100, "Display name too long").optional(),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(30, "Username must be less than 30 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Username can only contain lowercase letters, numbers, and underscores"
    )
    .optional(),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  avatarUrl: z.string().url("Invalid avatar URL").optional().or(z.literal("")),
});

export const socialLinkSchema = z.object({
  platform: z.string().min(1),
  url: z.string().url("Invalid URL"),
  displayOrder: z.number().int().min(0),
});

export const updateSocialLinksSchema = z
  .array(socialLinkSchema)
  .max(6, "Maximum 6 social links");

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type SocialLinkInput = z.infer<typeof socialLinkSchema>;

