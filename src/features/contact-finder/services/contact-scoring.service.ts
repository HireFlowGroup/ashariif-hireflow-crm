import type { Company } from "@/features/companies/domain";
import type {
  DiscoveredContactCandidate,
  SelectedDiscoveredContact,
} from "@/features/contact-finder/services/contact-validation.service";

const ROLE_SCORES: Array<{ keywords: string[]; score: number; label: string }> = [
  { keywords: ["recruitment manager"], score: 100, label: "Recruitment Manager" },
  { keywords: ["talent acquisition"], score: 95, label: "Talent Acquisition" },
  { keywords: ["recruiter", "recruitment"], score: 90, label: "Recruiter" },
  { keywords: ["hr manager", "head of hr"], score: 85, label: "HR Manager" },
  { keywords: ["hr business partner", "hrbp"], score: 80, label: "HR Business Partner" },
  { keywords: ["people & culture", "head of people"], score: 80, label: "Head of People" },
  { keywords: ["directeur", "director", "ceo", "eigenaar", "owner", "managing director"], score: 70, label: "Directeur" },
];

const MAILBOX_SCORES: Array<{ prefixes: string[]; score: number }> = [
  { prefixes: ["recruitment", "recruiter"], score: 65 },
  { prefixes: ["hr"], score: 65 },
  { prefixes: ["werkenbij", "vacatures"], score: 55 },
  { prefixes: ["careers", "jobs"], score: 55 },
  { prefixes: ["info"], score: 35 },
];

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

export function scoreRole(candidate: DiscoveredContactCandidate, company: Company): number {
  const title = (candidate.jobTitle ?? "").toLowerCase();
  const emailLocal = candidate.email?.split("@")[0]?.toLowerCase() ?? "";

  for (const role of ROLE_SCORES) {
    if (role.keywords.some((kw) => title.includes(kw))) {
      let score = role.score;
      if (company.employeeCountMax !== null && company.employeeCountMax <= 50 && role.score >= 70) {
        score += 5;
      }
      return score;
    }
  }

  if (candidate.isGeneralMailbox) {
    for (const mailbox of MAILBOX_SCORES) {
      if (mailbox.prefixes.some((p) => emailLocal.startsWith(p))) {
        return mailbox.score;
      }
    }
  }

  return candidate.isGeneralMailbox ? 35 : 20;
}

export function computeRelevanceScore(
  candidate: DiscoveredContactCandidate,
  company: Company,
): number {
  const roleScore = scoreRole(candidate, company);
  const verificationScore =
    VERIFICATION_SCORES[candidate.verification?.status ?? "unknown"] ?? 25;
  const sourceScore = SOURCE_SCORES[candidate.sourceType] ?? 25;

  return Math.round(0.45 * roleScore + 0.35 * verificationScore + 0.2 * sourceScore);
}

export function rankDiscoveredContacts(
  candidates: DiscoveredContactCandidate[],
  company: Company,
): Array<DiscoveredContactCandidate & { relevanceScore: number }> {
  return candidates
    .map((candidate) => ({
      ...candidate,
      relevanceScore: computeRelevanceScore(candidate, company),
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

export function selectBestDiscoveredContact(
  candidates: Array<DiscoveredContactCandidate & { relevanceScore: number }>,
  minScore = 50,
): SelectedDiscoveredContact | null {
  const personal = candidates.filter((c) => !c.isGeneralMailbox);
  const bestPersonal = personal.find((c) => c.relevanceScore >= minScore);
  if (bestPersonal?.email) {
    return toSelected(bestPersonal, "Hoogste persoonlijke recruitment/HR-match");
  }

  const mailboxes = candidates.filter((c) => c.isGeneralMailbox);
  const bestMailbox = mailboxes.find((c) => c.relevanceScore >= Math.min(minScore, 45));
  if (bestMailbox?.email) {
    return toSelected(bestMailbox, "Beste algemene recruitment/HR-mailbox");
  }

  return null;
}

function toSelected(
  candidate: DiscoveredContactCandidate & { relevanceScore: number },
  reason: string,
): SelectedDiscoveredContact {
  const name =
    candidate.fullName
    ?? `${candidate.firstName} ${candidate.lastName}`.trim()
    ?? null;

  return {
    contactId: candidate.existingContactId ?? null,
    email: candidate.email!,
    recipientName: candidate.isGeneralMailbox ? null : name,
    jobTitle: candidate.jobTitle,
    sourceType: candidate.sourceType,
    verificationStatus: candidate.verification?.status ?? "unknown",
    relevanceScore: candidate.relevanceScore,
    isGeneralMailbox: candidate.isGeneralMailbox,
    selectionReason: reason,
  };
}

export function toSelectedAlternatives(
  candidates: Array<DiscoveredContactCandidate & { relevanceScore: number }>,
  selectedEmail: string | null,
  limit = 5,
): SelectedDiscoveredContact[] {
  return candidates
    .filter((c) => c.email && c.email !== selectedEmail)
    .slice(0, limit)
    .map((c) => toSelected(c, "Alternatief contact"));
}
