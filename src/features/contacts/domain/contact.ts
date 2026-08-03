/** Branded identifier for a contact record within a tenant. */
export type ContactId = string & { readonly __brand: "ContactId" };

export function toContactId(value: string): ContactId {
  return value as ContactId;
}

export type Contact = {
  id: ContactId;
  organizationId: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  linkedinUrl: string | null;
  source: string | null;
  confidence: number | null;
  lastVerified: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateContactInput = {
  companyId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  phone?: string | null;
  jobTitle?: string | null;
  linkedinUrl?: string | null;
  source?: string | null;
  confidence?: number | null;
  lastVerified?: string | null;
};

export type ListContactsByCompanyInput = {
  companyId: string;
  limit?: number;
  offset?: number;
};

export type ListContactsByCompanyResult = {
  contacts: Contact[];
  total: number;
};

export type ContactCountByCompany = {
  companyId: string;
  count: number;
};
