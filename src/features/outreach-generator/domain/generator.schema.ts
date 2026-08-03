import { z } from "zod";

import type { OutreachGeneratorContent } from "@/features/outreach-generator/domain/generator.types";

const messageBlockSchema = z.object({
  subject: z.string().nullable().optional(),
  body: z.string(),
  referencedSignals: z.array(z.string()),
});

const callScriptSchema = z.object({
  opening: z.string(),
  discovery: z.string(),
  valueProposition: z.string(),
  close: z.string(),
  referencedSignals: z.array(z.string()),
});

export const outreachGeneratorContentSchema = z.object({
  coldEmail: messageBlockSchema,
  linkedinMessage: messageBlockSchema,
  callScript: callScriptSchema,
  voicemail: messageBlockSchema,
  followUp1: messageBlockSchema,
  followUp2: messageBlockSchema,
  followUp3: messageBlockSchema,
});

export function parseOutreachGeneratorContent(value: unknown): OutreachGeneratorContent {
  return outreachGeneratorContentSchema.parse(value);
}

export function ensureSignalReferences(
  content: OutreachGeneratorContent,
  availableSignals: string[],
): OutreachGeneratorContent {
  const fallbackSignal = availableSignals[0] ?? "recente hiring activiteit in HireFlow";

  const enrichMessages = (block: { body: string; referencedSignals: string[]; subject?: string | null }) => ({
    ...block,
    referencedSignals:
      block.referencedSignals.length > 0 ? block.referencedSignals : [fallbackSignal],
  });

  return {
    coldEmail: enrichMessages(content.coldEmail),
    linkedinMessage: enrichMessages(content.linkedinMessage),
    voicemail: enrichMessages(content.voicemail),
    followUp1: enrichMessages(content.followUp1),
    followUp2: enrichMessages(content.followUp2),
    followUp3: enrichMessages(content.followUp3),
    callScript: {
      ...content.callScript,
      referencedSignals:
        content.callScript.referencedSignals.length > 0
          ? content.callScript.referencedSignals
          : [fallbackSignal],
    },
  };
}
