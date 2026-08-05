import type { Company } from "@/features/companies/domain";
import {
  matchContactRole,
  scoreMailboxPrefix,
} from "@/features/contact-finder/domain/contact-role-priority";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

export type ContactReliabilityLevel = "high" | "medium" | "low";

export type ContactReliability = {
  level: ContactReliabilityLevel;
  score: number;
  summary: string;
  factors: string[];
};

const VERIFICATION_WEIGHTS = {
  verified: 30,
  likely: 22,
  catch_all: 12,
  unknown: 8,
  invalid: 0,
} as const;

const SOURCE_WEIGHTS: Record<DiscoveredContactCandidate["sourceType"], number> = {
  existing_crm: 25,
  company_website: 22,
  manual: 20,
  linkedin_public: 18,
  tavily_search: 14,
  opencorporates: 10,
  inferred: 6,
};

function levelFromScore(score: number): ContactReliabilityLevel {
  if (score >= 75) return "high";
  if (score >= 45) return "medium";
  return "low";
}

function levelLabel(level: ContactReliabilityLevel): string {
  switch (level) {
    case "high":
      return "Hoog";
    case "medium":
      return "Gemiddeld";
    case "low":
      return "Laag";
  }
}

export function computeContactReliability(
  candidate: DiscoveredContactCandidate,
  company: Company,
): ContactReliability {
  const factors: string[] = [];
  let score = 0;

  const name =
    candidate.fullName
    ?? `${candidate.firstName} ${candidate.lastName}`.trim()
    ?? "";

  if (name && name !== "Contact" && name !== "Team") {
    score += 15;
    factors.push(`Naam: ${name}`);
  } else {
    factors.push("Geen persoonlijke naam");
  }

  const role = matchContactRole(candidate.jobTitle);
  if (role) {
    score += 20;
    factors.push(`Functie: ${role.label}`);
  } else if (candidate.jobTitle) {
    score += 8;
    factors.push(`Functie: ${candidate.jobTitle}`);
  } else {
    factors.push("Geen functietitel");
  }

  if (candidate.linkedinUrl) {
    score += 15;
    factors.push("LinkedIn gevonden");
  } else {
    factors.push("Geen LinkedIn");
  }

  if (candidate.isGeneralMailbox) {
    const local = candidate.email?.split("@")[0]?.toLowerCase() ?? "";
    const mailboxScore = scoreMailboxPrefix(local);
    score += Math.round(mailboxScore * 0.35);
    factors.push(`Algemene mailbox (${local}@)`);
  } else if (candidate.email) {
    score += 18;
    factors.push("Persoonlijk e-mailadres");
  }

  const verification = candidate.verification?.status ?? "unknown";
  score += VERIFICATION_WEIGHTS[verification] ?? 8;
  factors.push(`Verificatie: ${verification}`);

  score += SOURCE_WEIGHTS[candidate.sourceType] ?? 6;
  factors.push(`Bron: ${candidate.sourceType}`);

  if (candidate.confidence >= 0.8) {
    score += 8;
    factors.push("Hoge bronconfidence");
  } else if (candidate.confidence >= 0.5) {
    score += 4;
  }

  if (
    company.domain
    && candidate.email?.endsWith(`@${company.domain.toLowerCase()}`)
  ) {
    score += 5;
    factors.push("E-mail op bedrijfsdomein");
  }

  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const level = levelFromScore(finalScore);

  const summary = candidate.isGeneralMailbox
    ? `Betrouwbaarheid: ${levelLabel(level)} (${finalScore}/100). Geen persoonlijke beslisser — fallback mailbox geselecteerd. ${factors.slice(0, 3).join(". ")}.`
    : `Betrouwbaarheid: ${levelLabel(level)} (${finalScore}/100). ${role ? `Beslisser: ${role.label}.` : "Rol onbekend."} ${factors.slice(0, 4).join(". ")}.`;

  return { level, score: finalScore, summary, factors };
}
