import type { Contact } from "@/features/contacts/domain";
import type { ExternalContactCandidate } from "@/features/contact-finder/domain";

export function normalizeContactEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function normalizeContactName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

export function isDuplicateContactCandidate(
  candidate: ExternalContactCandidate,
  existingContacts: Contact[],
): boolean {
  const candidateEmail = normalizeContactEmail(candidate.email);

  if (candidateEmail) {
    return existingContacts.some(
      (contact) => normalizeContactEmail(contact.email) === candidateEmail,
    );
  }

  const candidateName = normalizeContactName(candidate.firstName, candidate.lastName);

  return existingContacts.some((contact) => {
    const contactName = normalizeContactName(contact.firstName, contact.lastName);

    if (candidateName !== contactName) {
      return false;
    }

    const candidateTitle = candidate.jobTitle?.trim().toLowerCase() ?? "";
    const contactTitle = contact.jobTitle?.trim().toLowerCase() ?? "";

    if (!candidateTitle || !contactTitle) {
      return true;
    }

    return candidateTitle === contactTitle;
  });
}

export function dedupeContactCandidates(
  candidates: ExternalContactCandidate[],
): ExternalContactCandidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const emailKey = normalizeContactEmail(candidate.email);
    const key = emailKey || `${normalizeContactName(candidate.firstName, candidate.lastName)}::${candidate.jobTitle?.toLowerCase() ?? ""}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
