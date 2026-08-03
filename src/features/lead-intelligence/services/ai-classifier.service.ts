import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import type { CompanySearchCriteria } from "@/features/lead-intelligence/domain";
import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import { isOpenAIConfigured } from "@/lib/env";
import { getOpenAIClient } from "@/lib/openai/client";

export type AiClassificationResult = {
  sector: string | null;
  employeeCountLabel: string | null;
  aiSummary: string;
};

export async function classifyAndSummarizeLead(
  candidate: ExternalCompanyCandidate,
  criteria: CompanySearchCriteria,
): Promise<AiClassificationResult> {
  if (!isOpenAIConfigured()) {
    pipelineWarn("ai.skipped", { reason: "OPENAI_API_KEY niet geconfigureerd" });
    return fallbackClassification(candidate, criteria);
  }

  try {
    const client = getOpenAIClient();

    const prompt = `Je bent een recruitment intelligence assistent. Classificeer dit bedrijf voor een recruiter in Nederland.

Bedrijf: ${candidate.name}
Website: ${candidate.website ?? "onbekend"}
Branche (zoekopdracht): ${criteria.sector ?? "onbekend"}
Plaats: ${candidate.city ?? criteria.city ?? "onbekend"}
Provincie: ${candidate.province ?? criteria.region ?? "onbekend"}
Vacatures: ${candidate.vacancyCount}
LinkedIn: ${candidate.linkedinUrl ?? "onbekend"}
Beschrijving: ${candidate.description ?? "geen"}

Antwoord ALLEEN als JSON:
{
  "sector": "string of null",
  "employeeCountLabel": "bijv. 11-50 medewerkers of null",
  "aiSummary": "2-3 zinnen NL voor recruiter: waarom interessant, hiring signalen"
}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0.2,
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return fallbackClassification(candidate, criteria);
    }

    const parsed = JSON.parse(content) as AiClassificationResult;

    pipelineDebug("ai.classified", { name: candidate.name });

    return {
      sector: parsed.sector ?? candidate.sector,
      employeeCountLabel: parsed.employeeCountLabel ?? null,
      aiSummary: parsed.aiSummary ?? fallbackSummary(candidate),
    };
  } catch (error) {
    pipelineWarn("ai.failed", {
      message: error instanceof Error ? error.message : "Onbekende fout",
    });
    return fallbackClassification(candidate, criteria);
  }
}

function fallbackClassification(
  candidate: ExternalCompanyCandidate,
  criteria: CompanySearchCriteria,
): AiClassificationResult {
  return {
    sector: candidate.sector ?? criteria.sector ?? null,
    employeeCountLabel: candidate.employeeCountLabel,
    aiSummary: fallbackSummary(candidate),
  };
}

function fallbackSummary(candidate: ExternalCompanyCandidate): string {
  const parts = [
    candidate.name,
    candidate.sector ? `actief in ${candidate.sector}` : null,
    candidate.city ? `gevestigd in ${candidate.city}` : null,
    candidate.vacancyCount > 0 ? `${candidate.vacancyCount} vacature(s) gedetecteerd` : null,
  ].filter(Boolean);

  return `${parts.join(". ")}.`;
}
