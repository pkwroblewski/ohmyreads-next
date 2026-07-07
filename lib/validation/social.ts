import { z } from "zod";

export const targetUserIdSchema = z.string().uuid("Invalid user ID");
export const friendRequestIdSchema = z.string().uuid("Invalid request ID");
