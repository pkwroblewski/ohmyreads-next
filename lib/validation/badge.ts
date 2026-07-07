import { z } from "zod";

// Badge ids are string slugs (e.g. "first-checkin"), not UUIDs
export const badgeIdSchema = z
  .string()
  .trim()
  .min(1, "Invalid badge ID")
  .max(100, "Invalid badge ID");
