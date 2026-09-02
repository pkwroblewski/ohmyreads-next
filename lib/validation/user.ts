import { z } from "zod";

/**
 * Account-level settings (Phase 2, Task 11): password change and deletion.
 * The password rule is the one signup and reset-password already enforce.
 */
export const PASSWORD_MIN_LENGTH = 8;

/** bcrypt truncates at 72 bytes; anything longer would silently be shortened. */
export const PASSWORD_MAX_LENGTH = 72;

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`);

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "Choose a password that is different from your current one.",
    path: ["newPassword"],
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** The reader types their username to confirm; matched case-insensitively. */
export const deleteAccountSchema = z.object({
  confirmation: z
    .string()
    .trim()
    .min(1, "Type your username to confirm.")
    .max(30, "That does not match your username."),
});

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;

/**
 * How recent the sign-in must be for account deletion. There is no server-side
 * re-authentication, so the JWT's `amr` timestamp (the moment the reader last
 * proved who they are, unchanged by token refreshes) stands in for it.
 */
export const SESSION_FRESHNESS_SECONDS = 10 * 60;
