import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import type { LeadScoreResult } from "@/features/lead-scoring/domain/lead-score.types";
import { isOpenAIConfigured } from "@/lib/env";
import { getOpenAIClient } from "@/lib/openai/client";

/**
 * GPT writes human-readable score explanation ONLY.
 * Scores are already computed deterministically — never recalculated here.
 */
export async function generateScoreExplanation(
  result: LeadScoreResult,
  candidate: ExternalCompanyCandidate,
): Promise<string> {
  if (!isOpenAIConfigured()) {
    return buildFallbackExplanation(result, candidate);
  }

  try {
    const client = getOpenAIClient();

    const componentLines = result.weightedComponents
      .map(
        (component) =>
          `- ${component.label}: ${component.rawScore}/100 (gewicht ${component.weight}%, bijdrage ${component.weightedScore})`,
      )
      .join("\n");

    const prompt = `Je bent een recruitment intelligence analist. Schrijf een korte NL-uitleg (3-4 zinnen) voor een recruiter.

BELANGRIJK: De score is al berekend. Herbereken NIETS. Leg alleen uit.

Bedrijf: ${candidate.name}
Totale score: ${result.score}/100
Priority: ${result.priority}

Componenten:
${componentLines}

Vacatures: ${candidate.vacancyCount}
Plaats: ${candidate.city ?? "onbekend"}
Sector: ${candidate.sector ?? "onbekend"}

Schrijf waarom dit bedrijf priority ${result.priority} is en wat de belangrijkste hiring kansen zijn. Geen JSON, alleen plain text.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 250,
    });

    const explanation = response.choices[0]?.message?.content?.trim();

    pipelineDebug("lead-score.explanation.generated", {
      name: candidate.name,
      score: result.score,
      priority: result.priority,
    });

    return explanation || buildFallbackExplanation(result, candidate);
  } catch (error) {
    pipelineWarn("lead-score.explanation.failed", {
      message: error instanceof Error ? error.message : "Onbekende fout",
    });
    return buildFallbackExplanation(result, candidate);
  }
}

function buildFallbackExplanation(
  result: LeadScoreResult,
  candidate: ExternalCompanyCandidate,
): string {
  const top = [...result.weightedComponents].sort((a, b) => b.weightedScore - a.weightedScore)[0];

  return (
    `${candidate.name} scoort ${result.score}/100 (Priority ${result.priority}). ` +
    `Sterkste factor: ${top?.label ?? "onbekend"} (${top?.rawScore ?? 0}/100). ` +
    `${candidate.vacancyCount > 0 ? `${candidate.vacancyCount} vacature(s) gedetecteerd.` : "Nog geen vacatures gedetecteerd."}`
  );
}
