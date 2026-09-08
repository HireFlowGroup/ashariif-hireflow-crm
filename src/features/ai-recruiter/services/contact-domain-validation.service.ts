import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "outlook.com",
  "hotmail.com",
  "yahoo.com",
  "icloud.com",
  "live.com",
  "proton.me",
  "protonmail.com",
]);

function normalizeDomain(domain: string): string {
  return domain.toLowerCase().replace(/^www\./, "");
}

export function extractEmailDomain(email: string): string {
  return normalizeDomain(email.split("@")[1] ?? "");
}

export function contactEmailMatchesCompanyDomain(
  email: string,
  companyDomain: string | null | undefined,
): boolean {
  if (!email.includes("@")) return false;
  const emailDomain = extractEmailDomain(email);
  if (!emailDomain) return false;

  if (PERSONAL_EMAIL_DOMAINS.has(emailDomain)) return false;

  if (!companyDomain) return true;

  const normalizedCompany = normalizeDomain(companyDomain);
  return (
    emailDomain === normalizedCompany
    || emailDomain.endsWith(`.${normalizedCompany}`)
  );
}

export function selectContactWithMatchingDomain(input: {
  selected: SelectedDiscoveredContact | null;
  alternatives: SelectedDiscoveredContact[];
  companyDomain: string | null | undefined;
}): { contact: SelectedDiscoveredContact | null; invalidContact: boolean } {
  const candidates = [input.selected, ...input.alternatives].filter(
    (contact): contact is SelectedDiscoveredContact => Boolean(contact?.email),
  );

  for (const contact of candidates) {
    if (contactEmailMatchesCompanyDomain(contact.email, input.companyDomain)) {
      return { contact, invalidContact: false };
    }
  }

  return { contact: null, invalidContact: candidates.length > 0 };
}
