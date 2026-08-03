import type { Contact } from "@/features/contacts/domain";

export type ContactListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  source: string | null;
  confidence: number | null;
};

export function serializeContactForList(contact: Contact): ContactListItem {
  return {
    id: contact.id as string,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: contact.email,
    phone: contact.phone,
    jobTitle: contact.jobTitle,
    linkedinUrl: contact.linkedinUrl,
    source: contact.source,
    confidence: contact.confidence,
  };
}

export function formatContactName(contact: Pick<ContactListItem, "firstName" | "lastName">): string {
  return `${contact.firstName} ${contact.lastName}`.trim();
}

export function formatConfidence(confidence: number | null): string {
  if (confidence === null) {
    return "—";
  }

  return `${Math.round(confidence * 100)}%`;
}
