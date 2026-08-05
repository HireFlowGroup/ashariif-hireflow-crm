import { z } from "zod";

export const aiEmailWriterDraftSchema = z.object({
  subject: z.string().min(1),
  personalIntroduction: z.string().min(1),
  observedSituation: z.string().min(1),
  whyHireFlow: z.string().min(1),
  callToAction: z.string().min(1),
  closing: z.string().min(1),
  bodyText: z.string().min(1),
  wordCount: z.number().int().min(0),
});

export type AiEmailWriterDraftParsed = z.infer<typeof aiEmailWriterDraftSchema>;

export function parseAiEmailWriterDraft(value: unknown): AiEmailWriterDraftParsed | null {
  const parsed = aiEmailWriterDraftSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
