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

    const prompt = `Je valideert of een URL een echt bedrijf is (geen artikel, directory of gemeentepagina).

Antwoord ALLEEN als JSON:
{
  "results": [
    {
      "id": 0,
      "verdict": "company",
      "companyType": "company_website"
    }
  ]
}

verdict: "company" of "not_company" (exact)

companyType (alleen bij company):
- company_website (score 100): echte bedrijfswebsite
- holding (score 80): holding/moederbedrijf
- agency (score 70): bureau/agency/intermediair

Bij not_company, kies companyType:
- directory (30), news (20), government (10), spam (0)

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
      results?: Array<{ id: number; verdict: string; companyType?: string }>;
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
    return {
      verdict: "not_company",
      companyType,
      score: DISCOVERY_TYPE_SCORES[companyType],
      source: "heuristic",
    };
  }

  if (item.signalCount >= 4) {
    return {
      verdict: "company",
      companyType: "company_website",
      score: DISCOVERY_TYPE_SCORES.company_website,
      source: "heuristic",
    };
  }

  if (item.signalCount >= 2) {
    return {
      verdict: "company",
      companyType: "agency",
      score: DISCOVERY_TYPE_SCORES.agency,
      source: "heuristic",
    };
  }

  return {
    verdict: "not_company",
    companyType: "spam",
    score: DISCOVERY_TYPE_SCORES.spam,
    source: "heuristic",
  };
}

function mapValidationRow(row: {
  verdict: string;
  companyType?: string;
}): CompanyValidationResult {
  const verdict = row.verdict === "company" ? "company" : "not_company";
  const companyType = normalizeCompanyType(row.companyType, verdict);

  return {
    verdict,
    companyType,
    score: DISCOVERY_TYPE_SCORES[companyType],
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

/** Single-URL AI validation prompt (step 4). */
export async function validateSingleCompany(
  input: DiscoveryUrlInput & { signalCount: number; signalSummary: string },
): Promise<CompanyValidationResult> {
  const [result] = await validateCompanyCandidates([input]);
  return result ?? heuristicCompanyValidation(input);
}
