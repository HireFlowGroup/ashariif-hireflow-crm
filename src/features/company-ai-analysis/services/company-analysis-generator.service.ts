import {
  emptyAnalysisSections,
  parseCompanyAnalysisSections,
} from "@/features/company-ai-analysis/domain/analysis.schema";
import type {
  CompanyAnalysisContext,
  CompanyAnalysisSections,
} from "@/features/company-ai-analysis/domain/analysis.types";
import { buildAnalysisContextPayload } from "@/features/company-ai-analysis/services/build-analysis-context";
import {
  assessRecruitmentPotentialFromContext,
} from "@/features/company-intelligence/services/recruitment-potential.service";
import { pipelineDebug, pipelineWarn } from "@/features/lead-intelligence/debug/pipeline-debug";
import { getOpenAIClient } from "@/lib/ai/client";
import { isOpenAIConfiguredForActiveOrg } from "@/lib/ai/client";

const ANALYSIS_MODEL = "gpt-4o-mini";

export type GeneratedCompanyAnalysis = {
  sections: CompanyAnalysisSections;
  model: string | null;
};

export async function generateCompanyAnalysis(
  context: CompanyAnalysisContext,
): Promise<GeneratedCompanyAnalysis> {
  if (!isOpenAIConfiguredForActiveOrg()) {
    pipelineWarn("company-analysis.skipped", { reason: "OpenAI niet geconfigureerd" });
    return {
      sections: buildFallbackAnalysis(context),
      model: null,
    };
  }

  try {
    const client = getOpenAIClient();
    const payload = buildAnalysisContextPayload(context);

    const response = await client.chat.completions.create({
      model: ANALYSIS_MODEL,
      temperature: 0.1,
      max_tokens: 1800,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `Je bent HireFlow Company Intelligence AI. Analyseer elk bedrijf alsof je accountmanager bent.

STRICTE REGELS — GEEN HALLUCINATIES:
- Gebruik ALLEEN feiten uit de context. Verzin NOOIT namen, bedrijven, vacatures, contacten, ATS of concurrenten.
- Als data ontbreekt: schrijf exact "Geen data beschikbaar in HireFlow." voor dat veld.
- Bij concurrenten: noem ALLEEN bedrijven uit "VERGELIJKBARE BEDRIJVEN IN HIREFLOW". Geen externe concurrenten.
- Bij besluitvormer: gebruik contacten of outreach intelligence uit de data.
- Bij ATS: gebruik ATS providers uit de data of hiring signals.
- Bij geschikte functies: gebruik vacaturetitels en hiring signals.
- recruitmentPotential: exact LOW, MEDIUM of HIGH op basis van vacatures, groei, nieuws, LinkedIn hiring, investeringen, uitbreiding, vestigingen, reorganisaties, employer branding, ATS en recruitmentpartners.
- recruitmentPotentialMotivation: maximaal 120 woorden, Nederlands, commerciële accountmanager-toon.
- Schrijf in het Nederlands, concreet en professioneel (2-4 zinnen per veld, behalve motivatie).

Antwoord ALLEEN als JSON met exact deze keys:
{
  "summary": "...",
  "recruitmentSituation": "...",
  "recruitmentPotential": "LOW|MEDIUM|HIGH",
  "recruitmentPotentialMotivation": "...",
  "growth": "...",
  "challenges": "...",
  "outreachAdvice": "...",
  "likelyDecisionMaker": "...",
  "suitableRoles": "...",
  "likelyAts": "...",
  "competitors": "...",
  "topHiringSignal": "..."
}`,
        },
        {
          role: "user",
          content: payload,
        },
      ],
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      return {
        sections: buildFallbackAnalysis(context),
        model: ANALYSIS_MODEL,
      };
    }

    const parsed = parseCompanyAnalysisSections(JSON.parse(content));

    pipelineDebug("company-analysis.generated", { companyId: context.companyId });

    return {
      sections: parsed,
      model: ANALYSIS_MODEL,
    };
  } catch (error) {
    pipelineWarn("company-analysis.failed", {
      companyId: context.companyId,
      message: error instanceof Error ? error.message : "Onbekende fout",
    });

    return {
      sections: buildFallbackAnalysis(context),
      model: null,
    };
  }
}

export function buildFallbackAnalysis(context: CompanyAnalysisContext): CompanyAnalysisSections {
  const topSignal = context.signals[0] ?? null;
  const vacancyTitles = context.vacancies.map((vacancy) => vacancy.title).slice(0, 8);
  const hrContacts = context.contacts.filter((contact) =>
    /hr|recruit|talent|people|human resources/i.test(contact.jobTitle ?? ""),
  );

  const potential = assessRecruitmentPotentialFromContext(context);

  const decisionMaker =
    context.outreachRecommendedContact ??
    (hrContacts[0]
      ? `${hrContacts[0].name}${hrContacts[0].jobTitle ? ` (${hrContacts[0].jobTitle})` : ""}`
      : null);

  const competitors =
    context.similarCompanies.length > 0
      ? context.similarCompanies.map((company) => company.name).join(", ")
      : "Geen data beschikbaar in HireFlow.";

  const growthSignals = context.signals.filter((signal) =>
    ["new_location", "funding", "google_maps_change"].includes(signal.type),
  );

  return {
    summary: [
      context.companyName,
      context.sector ? `Sector: ${context.sector}` : null,
      context.city ? `Locatie: ${context.city}` : null,
      context.leadScore !== null ? `Leadscore ${context.leadScore} (prioriteit ${context.leadPriority ?? "—"})` : null,
      context.signalCount > 0 ? `${context.signalCount} hiring signals gedetecteerd` : "Nog geen hiring signals",
    ]
      .filter(Boolean)
      .join(". ")
      .concat("."),
    recruitmentSituation:
      context.vacancies.length > 0
        ? `${context.vacancies.length} vacature(s) actief in HireFlow. Hiring intensity: ${context.hiringIntensity}.`
        : `Geen vacatures in HireFlow. Hiring intensity: ${context.hiringIntensity}.`,
    recruitmentPotential: potential.recruitmentPotential,
    recruitmentPotentialMotivation: potential.motivation,
    growth:
      growthSignals.length > 0
        ? growthSignals
            .slice(0, 3)
            .map((signal) => `${signal.typeLabel}: ${signal.title ?? signal.description ?? "—"}`)
            .join(" ")
        : "Geen groeisignalen (vestiging/funding) in HireFlow.",
    challenges: context.scoreReason ?? "Geen data beschikbaar in HireFlow.",
    outreachAdvice:
      context.outreachAngle ??
      (topSignal
        ? `Benader op basis van ${topSignal.typeLabel.toLowerCase()}: ${topSignal.title ?? "recent hiring signaal"}.`
        : "Geen data beschikbaar in HireFlow."),
    likelyDecisionMaker: decisionMaker ?? "Geen contacten of outreach-aanbeveling in HireFlow.",
    suitableRoles:
      vacancyTitles.length > 0
        ? vacancyTitles.join(", ")
        : topSignal?.title ?? "Geen data beschikbaar in HireFlow.",
    likelyAts:
      context.atsProviders.length > 0
        ? context.atsProviders.join(", ")
        : "Geen ATS gedetecteerd in HireFlow.",
    competitors,
    topHiringSignal: topSignal
      ? `${topSignal.typeLabel}: ${topSignal.title ?? topSignal.description ?? "—"} (importance ${topSignal.importance})`
      : "Geen data beschikbaar in HireFlow.",
  };
}

export function buildEmptyAnalysis(reason: string): CompanyAnalysisSections {
  return emptyAnalysisSections(reason);
}
