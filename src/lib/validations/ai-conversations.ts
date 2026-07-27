import { z } from "zod";

export const createConversationSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Titel mag niet leeg zijn.")
    .max(120, "Titel mag maximaal 120 tekens bevatten.")
    .optional(),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const conversationIdParamSchema = z.string().uuid("Ongeldig gesprek-id.");
