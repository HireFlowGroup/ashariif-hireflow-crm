import type { OutreachIntelligenceContext } from "@/features/outreach-intelligence/domain/types";
import {
  ensureSignalReferences,
  parseOutreachGeneratorContent,
} from "@/features/outreach-generator/domain/generator.schema";
import type {
  OutreachGeneratorContent,
  OutreachWritingStyle,
} from "@/features/outreach-generator/domain/generator.types";
import {
  buildFallbackOutreachContent,
  buildOutreachGeneratorPrompt,
} from "@/features/outreach-generator/services/fallback-outreach-generator";
import { extractSignalLabels } from "@/features/outreach-generator/services/build-outreach-context";
import { isOpenAIConfiguredForActiveOrg } from "@/lib/ai/client";
import { getOpenAIClient } from "@/lib/ai/client";

const GENERATOR_MODEL = "gpt-4o-mini";

export type GeneratedOutreachContent = {
  content: OutreachGeneratorContent;
  model: string;
  primarySignalId: string | null;
  referencedSignalIds: string[];
};

export async function generateOutreachContent(
  context: OutreachIntelligenceContext,
  contactName: string | null,
  style: OutreachWritingStyle,
): Promise<GeneratedOutreachContent> {
  const signalLabels = extractSignalLabels(context);
  const primarySignalId = context.signals[0]?.id ?? null;
  const referencedSignalIds = context.signals.slice(0, 5).map((signal) => signal.id);

  if (!isOpenAIConfiguredForActiveOrg()) {
    return {
      content: ensureSignalReferences(
        buildFallbackOutreachContent(context, contactName, style),
        signalLabels,
      ),
      model: "fallback-template",
      primarySignalId,
      referencedSignalIds,
    };
  }

  try {
    const client = getOpenAIClient();
    const prompt = buildOutreachGeneratorPrompt(context, contactName, style);

    const response = await client.chat.completions.create({
      model: GENERATOR_MODEL,
      temperature: 0.35,
      max_tokens: 2500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "Je bent HireFlow Outreach Generator. Schrijf uitsluitend op basis van meegeleverde HireFlow-data. Elke tekst moet concrete hiring signals refereren. Geen generieke sales copy.",
        },
        { role: "user", content: prompt },
      ],
    });

    const raw = response.choices[0]?.message?.content;
    if (!raw) {
      throw new Error("Lege AI response");
    }

    const parsed = ensureSignalReferences(
      parseOutreachGeneratorContent(JSON.parse(raw)),
      signalLabels,
    );

    return {
      content: parsed,
      model: GENERATOR_MODEL,
      primarySignalId,
      referencedSignalIds,
    };
  } catch {
    return {
      content: ensureSignalReferences(
        buildFallbackOutreachContent(context, contactName, style),
        signalLabels,
      ),
      model: "fallback-template",
      primarySignalId,
      referencedSignalIds,
    };
  }
}
