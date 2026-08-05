import type { Contact } from "@/features/contacts/domain";
import { matchContactRole } from "@/features/contact-finder/domain/contact-role-priority";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

export function rankExistingContact(contact: Contact): number {
  return matchContactRole(contact.jobTitle)?.score ?? 10;
}

export function mapExistingContactToCandidate(contact: Contact): DiscoveredContactCandidate | null {
  if (!contact.email?.trim()) return null;

  const email = contact.email.trim().toLowerCase();
  const isGeneral = /^(recruitment|recruiter|hr|jobs|info)@/i.test(email);
  const role = matchContactRole(contact.jobTitle);

  return {
    firstName: contact.firstName,
    lastName: contact.lastName,
    fullName: `${contact.firstName} ${contact.lastName}`.trim() || null,
    email,
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    department: null,
    linkedinUrl: contact.linkedinUrl,
    sourceUrl: null,
    sourceType: "existing_crm",
    emailOrigin: "existing",
    isGeneralMailbox: isGeneral,
    isDecisionMaker: (role?.score ?? 0) >= 85,
    confidence: contact.confidence ?? 0.9,
    externalId: contact.id as string,
    existingContactId: contact.id as string,
    verification: {
      email,
      status: "likely",
      syntaxValid: true,
      domainValid: true,
      mxValid: true,
      disposable: false,
      roleMailbox: isGeneral,
      catchAll: isGeneral,
      reasons: ["bestaand_crm_contact"],
    },
  };
}

export function searchExistingCrmContacts(
  contacts: Contact[],
  _company?: unknown,
): DiscoveredContactCandidate[] {
  return contacts
    .filter((c) => c.email && !c.email.includes(" "))
    .map(mapExistingContactToCandidate)
    .filter((c): c is DiscoveredContactCandidate => c !== null)
    .sort(
      (a, b) =>
        (matchContactRole(b.jobTitle)?.score ?? 0) - (matchContactRole(a.jobTitle)?.score ?? 0),
    );
}
