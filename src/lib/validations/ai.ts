import { z } from "zod";

/** Max length for a single chat message (client form + API). */
export const AI_CHAT_MESSAGE_MAX_LENGTH = 4000;

/** Max number of turns in one API request. */
export const AI_CHAT_MAX_MESSAGES = 50;

/** Max combined character length of all message contents in one request. */
export const AI_CHAT_MAX_TOTAL_CONTENT_LENGTH = 32_000;

const aiChatMessageRoleSchema = z.enum(["user", "assistant"], {
  errorMap: () => ({ message: "Ongeldige rol; alleen user of assistant is toegestaan." }),
});

const aiChatMessageSchema = z.object({
  role: aiChatMessageRoleSchema,
  content: z
    .string()
    .trim()
    .min(1, "Bericht mag niet leeg zijn.")
    .max(
      AI_CHAT_MESSAGE_MAX_LENGTH,
      `Een bericht mag maximaal ${AI_CHAT_MESSAGE_MAX_LENGTH} tekens bevatten.`,
    ),
});

export const aiChatStreamRequestSchema = z
  .object({
    conversationId: z.string().uuid("Ongeldig gesprek-id.").optional(),
    messages: z
      .array(aiChatMessageSchema)
      .min(1, "Minimaal één bericht is verplicht.")
      .max(
        AI_CHAT_MAX_MESSAGES,
        `Er zijn maximaal ${AI_CHAT_MAX_MESSAGES} berichten per verzoek toegestaan.`,
      ),
  })
  .superRefine((data, ctx) => {
    const totalLength = data.messages.reduce(
      (sum, message) => sum + message.content.length,
      0,
    );

    if (totalLength > AI_CHAT_MAX_TOTAL_CONTENT_LENGTH) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `De totale invoer is te groot (maximaal ${AI_CHAT_MAX_TOTAL_CONTENT_LENGTH} tekens).`,
        path: ["messages"],
      });
    }
  });

export type AiChatStreamRequest = z.infer<typeof aiChatStreamRequestSchema>;

/** Client-side form validation for the assistant composer (single message). */
export const aiChatSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, "Message is required")
    .max(
      AI_CHAT_MESSAGE_MAX_LENGTH,
      `Message must be ${AI_CHAT_MESSAGE_MAX_LENGTH} characters or fewer`,
    ),
});

export type AiChatFormValues = z.infer<typeof aiChatSchema>;
