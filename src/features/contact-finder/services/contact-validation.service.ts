import type { Company } from "@/features/companies/domain";
import type { EmailVerificationResult } from "@/features/contact-finder/email-verification";

export type ContactSourceType =
  | "existing_crm"
  | "company_website"
  | "tavily_search"
  | "linkedin_public"
  | "inferred"
  | "manual"
  | "opencorporates";

export type DiscoveredContactCandidate = {
  firstName: string;
  lastName: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  department: string | null;
  linkedinUrl: string | null;
  sourceUrl: string | null;
  sourceType: ContactSourceType;
  emailOrigin: "published" | "extracted" | "inferred" | "existing";
  isGeneralMailbox: boolean;
  isDecisionMaker: boolean;
  confidence: number;
  externalId: string;
  existingContactId?: string | null;
  verification?: EmailVerificationResult;
};

export type ContactRejectionReason = {
  code: string;
  message: string;
  field?: string;
};

export type ContactFinderTraceEntry = {
  companyId: string;
  companyName: string;
  companyDomain: string | null;
  provider: string;
  query: string | null;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  rawResultCount: number;
  normalizedCount: number;
  validCount: number;
  rejectedCount: number;
  rejectionReasons: ContactRejectionReason[];
  error: string | null;
};

export type ContactDiscoveryStage =
  | "contact_found"
  | "general_mailbox_found"
  | "blocked_missing_contact"
  | "contact_lookup_failed";

export type SelectedDiscoveredContact = {
  contactId: string | null;
  email: string;
  recipientName: string | null;
  jobTitle: string | null;
  sourceType: ContactSourceType;
  verificationStatus: EmailVerificationResult["status"];
  relevanceScore: number;
  isGeneralMailbox: boolean;
  selectionReason: string;
};

export type ContactDiscoveryResult = {
  stage: ContactDiscoveryStage;
  selected: SelectedDiscoveredContact | null;
  alternatives: SelectedDiscoveredContact[];
  traces: ContactFinderTraceEntry[];
  errorMessage: string | null;
};

const NO_REPLY_PREFIXES = ["noreply", "no-reply", "donotreply", "mailer-daemon"];
const BLOCKED_PREFIXES = ["privacy", "abuse", "support", "postmaster"];

export function rejectContactCandidate(
  candidate: DiscoveredContactCandidate,
  company: Company,
  verification: EmailVerificationResult | undefined,
  options: {
    suppressedEmails: Set<string>;
    bouncedEmails: Set<string>;
    hasExplicitCompanySource?: boolean;
  },
): ContactRejectionReason | null {
  if (!candidate.email) {
    return { code: "missing_email", message: "Geen e-mailadres", field: "email" };
  }

  const email = candidate.email.trim().toLowerCase();
  const local = email.split("@")[0] ?? "";

  if (options.suppressedEmails.has(email)) {
    return { code: "suppressed", message: "E-mailadres op suppressielijst", field: "email" };
  }

  if (options.bouncedEmails.has(email)) {
    return { code: "bounced", message: "E-mailadres heeft hard bounce", field: "email" };
  }

  if (NO_REPLY_PREFIXES.some((p) => local.startsWith(p))) {
    return { code: "no_reply", message: "No-reply adres", field: "email" };
  }

  if (BLOCKED_PREFIXES.some((p) => local.startsWith(p)) && !candidate.isGeneralMailbox) {
    return { code: "blocked_mailbox", message: "Geblokkeerd mailboxtype", field: "email" };
  }

  if (verification?.status === "invalid") {
    return {
      code: "invalid_verification",
      message: verification.reasons.join(", ") || "E-mail niet geldig",
      field: "email",
    };
  }

  const companyDomain = company.domain?.toLowerCase() ?? extractDomainFromWebsite(company.website);
  const emailDomain = email.split("@")[1] ?? "";

  const personalDomains = ["gmail.com", "outlook.com", "hotmail.com", "yahoo.com", "icloud.com"];
  if (
    personalDomains.includes(emailDomain)
    && !options.hasExplicitCompanySource
    && candidate.sourceType !== "existing_crm"
    && candidate.emailOrigin !== "published"
  ) {
    return { code: "personal_email", message: "Persoonlijk e-maildomein zonder bedrijfsbron", field: "email" };
  }

  if (
    companyDomain
    && emailDomain !== companyDomain
    && candidate.emailOrigin === "inferred"
    && !candidate.isGeneralMailbox
  ) {
    return { code: "inferred_wrong_domain", message: "Afgeleid adres past niet bij bedrijfsdomein", field: "email" };
  }

  if (
    candidate.sourceType === "inferred"
    && candidate.emailOrigin === "inferred"
    && !verification?.mxValid
  ) {
    return { code: "inferred_unverified", message: "Afgeleid adres zonder MX-verificatie", field: "email" };
  }

  return null;
}

function extractDomainFromWebsite(website: string | null): string | null {
  if (!website) return null;
  try {
    const url = website.startsWith("http") ? website : `https://${website}`;
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function buildOutreachSalutation(
  recipientName: string | null,
  isGeneralMailbox: boolean,
  email: string,
): string {
  if (recipientName?.trim()) {
    const firstName = recipientName.trim().split(/\s+/)[0];
    return `Beste ${firstName},`;
  }

  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const hrPrefixes = ["hr", "recruitment", "recruiter", "vacatures", "werkenbij", "careers", "jobs", "personeel"];

  if (isGeneralMailbox && hrPrefixes.some((p) => local.startsWith(p))) {
    return "Beste HR- of recruitmentteam,";
  }

  if (local === "info") {
    return "Geachte heer/mevrouw,";
  }

  return "Geachte heer/mevrouw,";
}
