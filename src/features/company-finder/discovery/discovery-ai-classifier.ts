import type {
  CompanyValidationResult,
  DiscoveryCompanyType,
  DiscoveryUrlCategory,
  DiscoveryUrlInput,
  UrlClassificationResult,
} from "@/features/company-finder/discovery/discovery-quality.types";
import {
  DISCOVERY_TYPE_SCORES,
  URL_CATEGORY_TO_COMPANY_TYPE,
} from "@/features/company-finder/discovery/discovery-quality.types";
import { inferUrlCategoryHeuristic } from "@/features/company-finder/discovery/discovery-heuristics";
import { isOpenAIConfigured } from "@/lib/env";
import { getOpenAIClient } from "@/lib/openai/client";

export async function classifyDiscoveryUrls(
  inputs: DiscoveryUrlInput[],
): Promise<UrlClassificationResult[]> {
  if (inputs.length === 0) return [];

  if (!isOpenAIConfigured()) {
    return inputs.map((input) => ({
      url: input.url,
      title: input.title,
      category: inferUrlCategoryHeuristic(input),
      source: "heuristic" as const,
    }));
  }

  try {
    const client = getOpenAIClient();
    const payload = inputs.map((input, index) => ({
      id: index,
      url: input.url,
      title: input.title,
      description: input.description ?? "",
    }));

    const prompt = `Je bent een discovery classifier voor een bedrijfszoekmachine in Nederland.
Classificeer elke URL. Antwoord ALLEEN als JSON:

{
  "results": [
    { "id": 0, "category": "company" }
  ]
}

Categorieën (exact één per URL):
- company: echte bedrijfswebsite of merk-homepage
- directory: bedrijvengids, overzicht, lijst met meerdere bedrijven
- blog: blog, artikel, editorial content
- news: nieuws, persbericht, media-artikel
- government: gemeente, overheid, toerisme/welcome-pagina van stad
- listing: top-lijst, ranking, "beste bedrijven"
- jobboard: vacaturebank, recruitment platform
- social: social media profiel/pagina
- unknown: niet te bepalen

Regels:
- "Welcome to Rotterdam", "Top 250", "Bedrijven Rotterdam" → listing/directory/government, NOOIT company
- Alleen company mag verder in de pipeline

Input:
${JSON.stringify(payload, null, 2)}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return heuristicClassifications(inputs);
    }

    const parsed = JSON.parse(content) as {
      results?: Array<{ id: number; category: string }>;
    };

    const byId = new Map(
      (parsed.results ?? []).map((row) => [row.id, normalizeCategory(row.category)]),
    );

    return inputs.map((input, index) => ({
      url: input.url,
      title: input.title,
      category: byId.get(index) ?? inferUrlCategoryHeuristic(input),
      source: "ai" as const,
    }));
  } catch {
    return heuristicClassifications(inputs);
  }
}

export async function validateCompanyCandidates(
  items: Array<DiscoveryUrlInput & { signalCount: number; signalSummary: string }>,
): Promise<CompanyValidationResult[]> {
  if (items.length === 0) return [];

  if (!isOpenAIConfigured()) {
    return items.map((item) => heuristicCompanyValidation(item));
  }

  try {
    const client = getOpenAIClient();
    const payload = items.map((item, index) => ({
      id: index,
      url: item.url,
      title: item.title,
      description: item.description ?? "",
      homepageSignals: item.signalSummary,
      signalCount: item.signalCount,
    }));

    const prompt = `Is dit de officiële website van een bedrijf?

Antwoord uitsluitend met company of not_company, plus confidence.

Antwoord ALLEEN als JSON:
{
  "results": [
    {
      "id": 0,
      "verdict": "company",
      "confidence": 85,
      "companyType": "company_website"
    }
  ]
}

verdict: "company" of "not_company" (exact)
confidence: geheel getal 0-100

companyType (alleen bij company):
- company_website: echte bedrijfswebsite
- holding: holding/moederbedrijf
- agency: bureau/agency/intermediair

Bij not_company, kies companyType:
- directory, news, government, spam

Input:
${JSON.stringify(payload, null, 2)}`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1200,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      return items.map((item) => heuristicCompanyValidation(item));
    }

    const parsed = JSON.parse(content) as {
      results?: Array<{ id: number; verdict: string; companyType?: string; confidence?: number }>;
    };

    const byId = new Map((parsed.results ?? []).map((row) => [row.id, row]));

    return items.map((item, index) => {
      const row = byId.get(index);
      if (!row) return heuristicCompanyValidation(item);
      return mapValidationRow(row);
    });
  } catch {
    return items.map((item) => heuristicCompanyValidation(item));
  }
}

/** Alias used by consolidation decision flow. */
export async function decideCompanyUrls(
  inputs: DiscoveryUrlInput[],
): Promise<CompanyValidationResult[]> {
  return validateCompanyCandidates(
    inputs.map((input) => ({
      ...input,
      signalCount: 0,
      signalSummary: "",
    })),
  );
}

function heuristicClassifications(inputs: DiscoveryUrlInput[]): UrlClassificationResult[] {
  return inputs.map((input) => ({
    url: input.url,
    title: input.title,
    category: inferUrlCategoryHeuristic(input),
    source: "heuristic" as const,
  }));
}

function heuristicCompanyValidation(
  item: DiscoveryUrlInput & { signalCount: number },
): CompanyValidationResult {
  const urlCategory = inferUrlCategoryHeuristic(item);

  if (urlCategory !== "company") {
    const companyType = URL_CATEGORY_TO_COMPANY_TYPE[urlCategory] ?? "spam";
    const score = DISCOVERY_TYPE_SCORES[companyType];
    return {
      verdict: "not_company",
      confidence: score,
      companyType,
      score,
      source: "heuristic",
    };
  }

  if (item.signalCount >= 1) {
    return {
      verdict: "company",
      confidence: item.signalCount >= 4 ? 85 : 65,
      companyType: item.signalCount >= 4 ? "company_website" : "agency",
      score: item.signalCount >= 4 ? 85 : 65,
      source: "heuristic",
    };
  }

  return {
    verdict: "company",
    confidence: 55,
    companyType: "agency",
    score: 55,
    source: "heuristic",
  };
}

function mapValidationRow(row: {
  verdict: string;
  companyType?: string;
  confidence?: number;
}): CompanyValidationResult {
  const verdict = row.verdict === "company" ? "company" : "not_company";
  const companyType = normalizeCompanyType(row.companyType, verdict);
  const typeScore = DISCOVERY_TYPE_SCORES[companyType];
  const confidence =
    typeof row.confidence === "number" && Number.isFinite(row.confidence)
      ? Math.max(0, Math.min(100, Math.round(row.confidence)))
      : typeScore;

  return {
    verdict,
    confidence,
    companyType,
    score: confidence,
    source: "ai",
  };
}

function normalizeCategory(value: string): DiscoveryUrlCategory {
  const allowed: DiscoveryUrlCategory[] = [
    "company",
    "directory",
    "blog",
    "news",
    "government",
    "listing",
    "jobboard",
    "social",
    "forum",
    "unknown",
  ];

  const normalized = value.toLowerCase().trim() as DiscoveryUrlCategory;
  return allowed.includes(normalized) ? normalized : "unknown";
}

function normalizeCompanyType(
  value: string | undefined,
  verdict: "company" | "not_company",
): DiscoveryCompanyType {
  const allowed: DiscoveryCompanyType[] = [
    "company_website",
    "holding",
    "agency",
    "directory",
    "news",
    "government",
    "spam",
  ];

  const normalized = (value ?? "").toLowerCase().trim() as DiscoveryCompanyType;
  if (allowed.includes(normalized)) return normalized;

  return verdict === "company" ? "company_website" : "spam";
}

/** Parse free-text AI answers shaped like the exclusive prompt. */
export function parseAiDecisionText(text: string): {
  verdict: "company" | "not_company";
  confidence: number;
} {
  const lower = text.toLowerCase();
  const verdict: "company" | "not_company" = /\bnot_company\b/.test(lower)
    ? "not_company"
    : /\bcompany\b/.test(lower)
      ? "company"
      : "not_company";

  const confidenceMatch = text.match(/confidence\s*[:=]?\s*(\d{1,3})/i);
  const confidence = confidenceMatch
    ? Number(confidenceMatch[1])
    : verdict === "company"
      ? 60
      : 20;

  return {
    verdict,
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
  };
}

/** Single-URL AI validation prompt (step 4). */
export async function validateSingleCompany(
  input: DiscoveryUrlInput & { signalCount: number; signalSummary: string },
): Promise<CompanyValidationResult> {
  const [result] = await validateCompanyCandidates([input]);
  return result ?? heuristicCompanyValidation(input);
}
