import { z } from "zod";

export const sendWelcomeEmailSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Invalid email address")
    .max(254, "Invalid email address"),
  username: z
    .string()
    .trim()
    .min(1, "Username is required")
    .max(100, "Invalid username"),
  displayName: z.string().trim().max(100, "Invalid display name").optional(),
});

export type SendWelcomeEmailInput = z.infer<typeof sendWelcomeEmailSchema>;
