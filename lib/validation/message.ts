import { z } from "zod";

export const friendIdSchema = z.string().uuid("Invalid friend ID");
export const messageIdSchema = z.string().uuid("Invalid message ID");

export const sendMessageSchema = z.object({
  receiverId: z.string().uuid("Invalid recipient ID"),
  content: z
    .string()
    .trim()
    .min(1, "Message cannot be empty")
    .max(2000, "Message is too long (max 2000 characters)"),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
