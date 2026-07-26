import { z } from "zod";

export const aiChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(4000, "Message must be 4000 characters or fewer"),
});

export type AiChatFormValues = z.infer<typeof aiChatSchema>;

export const aiChatRequestSchema = z.object({
  message: aiChatSchema.shape.message,
});
