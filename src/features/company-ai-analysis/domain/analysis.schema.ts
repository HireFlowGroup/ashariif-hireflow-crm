import { z } from "zod";

import type { CompanyAnalysisSections } from "@/features/company-ai-analysis/domain/analysis.types";

export const companyAnalysisSectionsSchema = z.object({
  summary: z.string(),
  recruitmentSituation: z.string(),
  growth: z.string(),
  challenges: z.string(),
  outreachAdvice: z.string(),
  likelyDecisionMaker: z.string(),
  suitableRoles: z.string(),
  likelyAts: z.string(),
  competitors: z.string(),
  topHiringSignal: z.string(),
});

export function parseCompanyAnalysisSections(value: unknown): CompanyAnalysisSections {
  const parsed = companyAnalysisSectionsSchema.safeParse(value);

  if (parsed.success) {
    return sanitizeSections(parsed.data);
  }

  return emptyAnalysisSections("Analyse kon niet worden geparsed.");
}

function sanitizeSections(sections: CompanyAnalysisSections): CompanyAnalysisSections {
  const entries = Object.entries(sections) as [keyof CompanyAnalysisSections, string][];

  return Object.fromEntries(
    entries.map(([key, value]) => [key, value.trim().slice(0, 2000)]),
  ) as CompanyAnalysisSections;
}

export function emptyAnalysisSections(reason: string): CompanyAnalysisSections {
  const unavailable = reason;

  return {
    summary: unavailable,
    recruitmentSituation: unavailable,
    growth: unavailable,
    challenges: unavailable,
    outreachAdvice: unavailable,
    likelyDecisionMaker: unavailable,
    suitableRoles: unavailable,
    likelyAts: unavailable,
    competitors: unavailable,
    topHiringSignal: unavailable,
  };
}
