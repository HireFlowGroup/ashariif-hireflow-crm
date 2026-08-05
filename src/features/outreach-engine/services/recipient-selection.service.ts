import type { Company } from "@/features/companies/domain";
import {
  MAILBOX_FALLBACK_PREFIXES,
  matchContactRole,
  pickBestMailboxEmail,
} from "@/features/contact-finder/domain/contact-role-priority";
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email.trim());
}

function scoreContact(contact: OutreachContactRecord, company: Company): number {
  const matched = matchContactRole(contact.jobTitle);
  let score = matched?.score ?? 0;

  if (contact.email) score += 20;
  if (contact.confidence !== null && contact.confidence >= 0.7) score += 10;

  if (company.employeeCountMax !== null && company.employeeCountMax <= 50) {
    const title = (contact.jobTitle ?? "").toLowerCase();
    if (title.includes("directeur") || title.includes("owner") || title.includes("eigenaar")) {
      score += 15;
    }
  }

  return score;
}

function isGenericMailbox(email: string): boolean {
  const local = email.toLowerCase().split("@")[0] ?? "";
  return MAILBOX_FALLBACK_PREFIXES.some((p) => local.startsWith(p));
}

function pickGenericCompanyEmail(company: Company): string | null {
  const published = pickBestMailboxEmail(
    [company.hrEmail, company.generalEmail, company.email].filter(Boolean) as string[],
  );
  if (published && isValidEmail(published)) return published.trim().toLowerCase();

  if (company.domain) {
    for (const prefix of MAILBOX_FALLBACK_PREFIXES) {
      const mailbox = `${prefix}@${company.domain}`;
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

    const role = matchContactRole(contact.jobTitle);

    return {
      ok: true,
      recipientEmail: email,
      recipientName: `${contact.firstName} ${contact.lastName}`.trim(),
      contactId: contact.id,
      source: "contact",
      roleLabel: role?.label ?? contact.jobTitle,
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

    const local = genericEmail.split("@")[0] ?? "";
    const source = local.startsWith("recruitment") || local.startsWith("hr")
      ? "company_hr"
      : local.startsWith("info")
        ? "company_email"
        : "generic_mailbox";

    return {
      ok: true,
      recipientEmail: genericEmail,
      recipientName: null,
      contactId: null,
      source,
      roleLabel: source === "company_hr" ? "HR/recruitment mailbox" : "Algemeen zakelijk",
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
