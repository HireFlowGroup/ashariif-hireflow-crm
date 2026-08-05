import type { Company } from "@/features/companies/domain";
import type { Contact } from "@/features/contacts/domain";
import type { DiscoveredContactCandidate } from "@/features/contact-finder/services/contact-validation.service";

const ROLE_RANK: Array<{ keywords: string[]; score: number }> = [
  { keywords: ["recruitment manager"], score: 100 },
  { keywords: ["talent acquisition"], score: 95 },
  { keywords: ["recruiter"], score: 90 },
  { keywords: ["hr manager", "head of hr"], score: 85 },
  { keywords: ["hr business partner", "hrbp"], score: 80 },
  { keywords: ["people", "culture"], score: 80 },
  { keywords: ["directeur", "director", "ceo", "owner", "eigenaar"], score: 70 },
];

export function rankExistingContact(contact: Contact): number {
  return rankJobTitle(contact.jobTitle);
}

function rankJobTitle(jobTitle: string | null | undefined): number {
  const title = (jobTitle ?? "").toLowerCase();
  for (const role of ROLE_RANK) {
    if (role.keywords.some((kw) => title.includes(kw))) return role.score;
  }
  return 10;
}

export function mapExistingContactToCandidate(contact: Contact): DiscoveredContactCandidate | null {
  if (!contact.email?.trim()) return null;

  const email = contact.email.trim().toLowerCase();
  const isGeneral = /^(hr|recruitment|recruiter|werkenbij|vacatures|careers|jobs|info)@/i.test(email);

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
    isDecisionMaker: rankExistingContact(contact) >= 85,
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
  company: Company,
): DiscoveredContactCandidate[] {
  return contacts
    .filter((c) => c.email && !c.email.includes(" "))
    .map(mapExistingContactToCandidate)
    .filter((c): c is DiscoveredContactCandidate => c !== null)
    .sort((a, b) => rankJobTitle(b.jobTitle) - rankJobTitle(a.jobTitle));
}
