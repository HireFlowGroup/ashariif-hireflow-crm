import type { Company } from "@/features/companies/domain";
import type { RecipientSelectionResult } from "@/features/outreach-engine/domain/types";

export type OutreachContactRecord = {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  email: string | null;
  confidence: number | null;
  outreachOptOut: boolean;
};

const ROLE_PRIORITY: Array<{ keywords: string[]; label: string }> = [
  { keywords: ["hr manager", "hr-manager", "head of hr"], label: "HR Manager" },
  { keywords: ["recruitment manager", "recruiter", "talent acquisition", "recruitment lead"], label: "Recruitment Manager" },
  { keywords: ["talent acquisition", "ta manager", "talent manager"], label: "Talent Acquisition" },
  { keywords: ["hr business partner", "hrbp"], label: "HR Business Partner" },
  { keywords: ["directeur", "director", "ceo", "founder", "eigenaar", "owner", "managing director"], label: "Directeur/Eigenaar" },
];

const GENERIC_MAILBOX_PREFIXES = ["hr@", "recruitment@", "vacatures@", "werkenbij@", "jobs@", "careers@", "info@"];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function scoreContact(contact: OutreachContactRecord, company: Company): number {
  const title = (contact.jobTitle ?? "").toLowerCase();
  let score = 0;

  for (let index = 0; index < ROLE_PRIORITY.length; index += 1) {
    const role = ROLE_PRIORITY[index]!;
    if (role.keywords.some((kw) => title.includes(kw))) {
      score += 100 - index * 10;
      break;
    }
  }

  if (contact.email) score += 20;
  if (contact.confidence !== null && contact.confidence >= 0.7) score += 10;

  if (company.employeeCountMax !== null && company.employeeCountMax <= 50) {
    if (title.includes("directeur") || title.includes("owner") || title.includes("eigenaar")) {
      score += 15;
    }
  }

  return score;
}

function isGenericMailbox(email: string): boolean {
  const lower = email.toLowerCase();
  return GENERIC_MAILBOX_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function pickGenericCompanyEmail(company: Company): string | null {
  const candidates = [
    company.hrEmail,
    company.generalEmail,
    company.email,
  ].filter(Boolean) as string[];

  for (const email of candidates) {
    if (isValidEmail(email)) return email.trim().toLowerCase();
  }

  if (company.domain) {
    for (const prefix of GENERIC_MAILBOX_PREFIXES) {
      const mailbox = `${prefix.replace("@", "")}@${company.domain}`;
      if (isValidEmail(mailbox)) return mailbox;
    }
  }

  return null;
}

export type RecipientSelectionContext = {
  company: Company;
  contacts: OutreachContactRecord[];
  suppressedEmails: Set<string>;
  recentlyContactedCompanyIds: Set<string>;
  bouncedEmails: Set<string>;
};

export function selectRecipient(context: RecipientSelectionContext): RecipientSelectionResult {
  const { company } = context;

  if (company.outreachOptOut) {
    return { ok: false, code: "opt_out", reason: "Bedrijf heeft outreach opt-out." };
  }

  if (company.status === "archived" || company.status === "inactive") {
    return { ok: false, code: "archived", reason: "Bedrijf is gearchiveerd." };
  }

  if (context.recentlyContactedCompanyIds.has(company.id as string)) {
    return { ok: false, code: "cooldown", reason: "Bedrijf recent benaderd (30 dagen cooldown)." };
  }

  const rankedContacts = context.contacts
    .filter((c) => !c.outreachOptOut && c.email && isValidEmail(c.email))
    .map((contact) => ({ contact, score: scoreContact(contact, company) }))
    .sort((a, b) => b.score - a.score);

  for (const { contact } of rankedContacts) {
    const email = contact.email!.trim().toLowerCase();

    if (context.suppressedEmails.has(email)) {
      continue;
    }

    if (context.bouncedEmails.has(email)) {
      continue;
    }

    if (isGenericMailbox(email)) {
      continue;
    }

    return {
      ok: true,
      recipientEmail: email,
      recipientName: `${contact.firstName} ${contact.lastName}`.trim(),
      contactId: contact.id,
      source: "contact",
      roleLabel: contact.jobTitle,
    };
  }

  const genericEmail = pickGenericCompanyEmail(company);
  if (genericEmail) {
    if (context.suppressedEmails.has(genericEmail)) {
      return { ok: false, code: "opt_out", reason: "E-mailadres staat op suppressielijst." };
    }
    if (context.bouncedEmails.has(genericEmail)) {
      return { ok: false, code: "bounced", reason: "E-mailadres heeft eerder gebounced." };
    }

    const source = genericEmail.startsWith("hr@")
      ? "company_hr"
      : genericEmail.startsWith("info@")
        ? "company_email"
        : "generic_mailbox";

    return {
      ok: true,
      recipientEmail: genericEmail,
      recipientName: null,
      contactId: null,
      source,
      roleLabel: source === "company_hr" ? "HR afdeling" : "Algemeen zakelijk",
    };
  }

  return {
    ok: false,
    code: "missing_recipient",
    reason: "Geen geldig zakelijk e-mailadres gevonden voor dit bedrijf.",
  };
}

export function findDuplicateRecipient(
  recipientEmail: string,
  existingEmails: Set<string>,
): boolean {
  return existingEmails.has(recipientEmail.trim().toLowerCase());
}
