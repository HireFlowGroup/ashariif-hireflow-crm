import type { Company } from "@/features/companies/domain";
import {
  DEFAULT_CONTACT_TARGET_ROLES,
  matchContactRole,
  rankMailboxEmail,
  scoreMailboxPrefix,
} from "@/features/contact-finder/domain/contact-role-priority";
import { computeContactReliability } from "@/features/contact-finder/services/contact-reliability.service";
import type {
  ContactReliability,
  DiscoveredContactCandidate,
  SelectedDiscoveredContact,
} from "@/features/contact-finder/services/contact-validation.service";

export type { ContactReliability };

const SOURCE_SCORES: Record<DiscoveredContactCandidate["sourceType"], number> = {
  company_website: 100,
  existing_crm: 95,
  linkedin_public: 80,
  tavily_search: 70,
  manual: 90,
  opencorporates: 60,
  inferred: 25,
};

const VERIFICATION_SCORES = {
  verified: 100,
  likely: 75,
  catch_all: 50,
  unknown: 25,
  invalid: 0,
} as const;

function targetRoleBoost(jobTitle: string | null | undefined, targetRoles: string[]): number {
  if (!jobTitle || targetRoles.length === 0) return 0;
  const lower = jobTitle.toLowerCase();
  for (let i = 0; i < targetRoles.length; i += 1) {
    if (lower.includes(targetRoles[i]!.toLowerCase())) {
      return Math.max(0, 15 - i * 2);
    }
  }
  return 0;
}

export function scoreRole(candidate: DiscoveredContactCandidate, company: Company): number {
  const title = (candidate.jobTitle ?? "").toLowerCase();
  const emailLocal = candidate.email?.split("@")[0]?.toLowerCase() ?? "";

  const matched = matchContactRole(candidate.jobTitle);
  if (matched) {
    let score = matched.score;
    if (company.employeeCountMax !== null && company.employeeCountMax <= 50 && matched.score >= 70) {
      score += 5;
    }
    return score;
  }

  if (candidate.isGeneralMailbox) {
    return scoreMailboxPrefix(emailLocal);
  }

  if (/hr|recruit|talent|people/i.test(title)) {
    return 40;
  }

  return candidate.isGeneralMailbox ? 35 : 20;
}

export function computeRelevanceScore(
  candidate: DiscoveredContactCandidate,
  company: Company,
  targetRoles: string[] = [...DEFAULT_CONTACT_TARGET_ROLES],
): number {
  const roleScore = scoreRole(candidate, company) + targetRoleBoost(candidate.jobTitle, targetRoles);
  const verificationScore =
    VERIFICATION_SCORES[candidate.verification?.status ?? "unknown"] ?? 25;
  const sourceScore = SOURCE_SCORES[candidate.sourceType] ?? 25;

  return Math.round(0.45 * roleScore + 0.35 * verificationScore + 0.2 * sourceScore);
}

export function rankDiscoveredContacts(
  candidates: DiscoveredContactCandidate[],
  company: Company,
  targetRoles: string[] = [...DEFAULT_CONTACT_TARGET_ROLES],
): Array<DiscoveredContactCandidate & { relevanceScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      relevanceScore: computeRelevanceScore(candidate, company, targetRoles),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function selectBestDiscoveredContact(
  candidates: Array<DiscoveredContactCandidate & { relevanceScore: number }>,
  company: Company,
  minScore = 50,
): SelectedDiscoveredContact | null {
  const personal = candidates.filter((c) => !c.isGeneralMailbox);
  const bestPersonal = personal.find((c) => c.relevanceScore >= minScore);
  if (bestPersonal?.email) {
    const role = matchContactRole(bestPersonal.jobTitle);
    return toSelected(
      bestPersonal,
      company,
      role
        ? `Beslisser gevonden: ${role.label} (prioriteit ${role.score})`
        : "Hoogste persoonlijke recruitment/HR-match",
    );
  }

  const mailboxes = candidates.filter((c) => c.isGeneralMailbox);
  const sortedMailboxes = [...mailboxes].sort((a, b) => {
    const prefixDiff = rankMailboxEmail(a.email ?? "") - rankMailboxEmail(b.email ?? "");
    if (prefixDiff !== 0) return prefixDiff;
    return b.relevanceScore - a.relevanceScore;
  });
  const bestMailbox = sortedMailboxes.find((c) => c.relevanceScore >= Math.min(minScore, 35));
  if (bestMailbox?.email) {
    const local = bestMailbox.email.split("@")[0] ?? "mailbox";
    return toSelected(
      bestMailbox,
      company,
      `Geen persoonlijke mail — fallback ${local}@ geselecteerd`,
    );
  }

  return null;
}

function toSelected(
  candidate: DiscoveredContactCandidate & { relevanceScore: number },
  company: Company,
  reason: string,
): SelectedDiscoveredContact {
  const name =
    candidate.fullName
    ?? `${candidate.firstName} ${candidate.lastName}`.trim()
    ?? null;

  const role = matchContactRole(candidate.jobTitle);
  const reliability = computeContactReliability(candidate, company);

  return {
    contactId: candidate.existingContactId ?? null,
    email: candidate.email!,
    recipientName: candidate.isGeneralMailbox ? null : name,
    jobTitle: candidate.jobTitle,
    linkedinUrl: candidate.linkedinUrl,
    sourceType: candidate.sourceType,
    verificationStatus: candidate.verification?.status ?? "unknown",
    relevanceScore: candidate.relevanceScore,
    confidence: candidate.confidence,
    isGeneralMailbox: candidate.isGeneralMailbox,
    roleLabel: role?.label ?? (candidate.isGeneralMailbox ? "Algemene mailbox" : null),
    reliability,
    selectionReason: `${reason}. ${reliability.summary}`,
  };
}

export function toSelectedAlternatives(
  candidates: Array<DiscoveredContactCandidate & { relevanceScore: number }>,
  company: Company,
  selectedEmail: string | null,
  limit = 5,
): SelectedDiscoveredContact[] {
  return candidates
    .filter((c) => c.email && c.email !== selectedEmail)
    .slice(0, limit)
    .map((c) => toSelected(c, company, "Alternatief contact"));
}
