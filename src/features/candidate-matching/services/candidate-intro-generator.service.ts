import "server-only";

import type { Vacancy } from "@/features/vacancies/domain";
import type {
  CandidateIntroduction,
  CandidateMatchInput,
  CandidateMatchResult,
} from "@/features/candidate-matching/domain/match.types";
import { candidateIntroductionSchema } from "@/features/candidate-matching/domain/match.types";
import { isOpenAIConfigured } from "@/platform/config/env";
import { getOpenAIClient } from "@/lib/ai/client";

const MAX_WORDS = 150;

const BANNED_PHRASES = [
  "perfecte kandidaat",
  "beste kandidaat",
  "gegarandeerd",
  "100% match",
  "ideal candidate",
  "must hire",
  "zonder twijfel",
  "unicum",
];

const RECRUITER_SYSTEM_PROMPT = `Je bent de beste recruiter van Europa bij HireFlow Group.
Schrijf een kandidaatintroductie voor de opdrachtgever in het Nederlands.

Doel: de kandidaat eerlijk presenteren — sterke punten benadrukken, risico's niet verzwijgen.

REGELS:
- Maximaal ${MAX_WORDS} woorden in bodyText
- Professioneel, concreet, geen hype of superlatieven
- Noem minimaal één sterk punt en één aandachtspunt of nuance
- Gebruik alleen feiten uit de context
- Geen verzonnen certificaten, jaren of resultaten
- Geen "perfecte kandidaat" of vergelijkbare claims
- Sluit af met een concrete vervolgstap (bijv. gesprek plannen)`;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function truncateWords(text: string, limit: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= limit) return text.trim();
  return `${words.slice(0, limit).join(" ")}…`;
}

function buildFactsPayload(
  vacancy: Vacancy,
  candidate: CandidateMatchInput,
  match: CandidateMatchResult,
  companyName: string | null,
): string {
  return [
    `Opdrachtgever: ${companyName ?? "onbekend"}`,
    `Vacature: ${vacancy.title}`,
    vacancy.location ? `Locatie vacature: ${vacancy.location}` : null,
    `Kandidaat: ${candidate.firstName} ${candidate.lastName}`,
    candidate.currentRole ? `Huidige rol: ${candidate.currentRole}` : null,
    candidate.location ? `Locatie kandidaat: ${candidate.location}` : null,
    candidate.experienceYears != null ? `Ervaring: ${candidate.experienceYears} jaar` : null,
    (candidate.skills ?? []).length ? `Skills: ${(candidate.skills ?? []).join(", ")}` : null,
    candidate.summary ? `Profiel: ${candidate.summary.slice(0, 400)}` : null,
    `Matchscore: ${match.matchScore}/100`,
    `Sterke punten: ${match.strongPoints.join("; ")}`,
    `Risico's: ${match.risks.join("; ")}`,
    `Salarisverwachting: ${match.salaryExpectation}`,
    `Beschikbaarheid: ${match.availability}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildFallbackIntroduction(
  vacancy: Vacancy,
  candidate: CandidateMatchInput,
  match: CandidateMatchResult,
  companyName: string | null,
): CandidateIntroduction {
  const name = `${candidate.firstName} ${candidate.lastName}`;
  const role = candidate.currentRole ?? "recruitment professional";
  const client = companyName ?? "uw organisatie";

  const strength = match.strongPoints[0] ?? "Relevante achtergrond voor deze rol.";
  const risk = match.risks[0] ?? "Aanvullende screening in een intake aanbevolen.";

  const bodyText = truncateWords(
    [
      `Voor ${client} heb ik ${name} beoordeeld op de vacature ${vacancy.title}.`,
      `${name} is momenteel actief als ${role}${candidate.experienceYears != null ? ` met ${candidate.experienceYears} jaar ervaring` : ""}.`,
      strength,
      `Let op: ${risk.replace(/\.$/, "")}.`,
      `Matchscore: ${match.matchScore}/100. Salarisverwachting: ${match.salaryExpectation}. Beschikbaarheid: ${match.availability}.`,
      "Ik stel voor om een kort kennismakingsgesprek in te plannen om fit en verwachtingen te toetsen.",
    ].join(" "),
    MAX_WORDS,
  );

  return candidateIntroductionSchema.parse({
    bodyText,
    wordCount: countWords(bodyText),
    confidence: match.confidence >= 0.7 ? 0.78 : 0.62,
  });
}

export async function generateCandidateIntroduction(
  vacancy: Vacancy,
  candidate: CandidateMatchInput,
  match: CandidateMatchResult,
  companyName: string | null = null,
): Promise<CandidateIntroduction> {
  const fallback = buildFallbackIntroduction(vacancy, candidate, match, companyName);

  if (!isOpenAIConfigured()) {
    return fallback;
  }

  const facts = buildFactsPayload(vacancy, candidate, match, companyName);

  try {
    const client = getOpenAIClient();
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: RECRUITER_SYSTEM_PROMPT },
        {
          role: "user",
          content: `CONTEXT:\n${facts}\n\nJSON: { bodyText, wordCount, confidence:0-1 }`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.35,
      max_tokens: 700,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return fallback;

    const parsed = candidateIntroductionSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return fallback;

    for (const phrase of BANNED_PHRASES) {
      if (parsed.data.bodyText.toLowerCase().includes(phrase)) {
        return fallback;
      }
    }

    let bodyText = parsed.data.bodyText;
    if (countWords(bodyText) > MAX_WORDS) {
      bodyText = truncateWords(bodyText, MAX_WORDS);
    }

    return {
      ...parsed.data,
      bodyText,
      wordCount: countWords(bodyText),
    };
  } catch {
    return fallback;
  }
}
