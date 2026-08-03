import type { Contact as ContactRow } from "@/types/crm";
import { type Contact, toContactId } from "@/features/contacts/domain";

type ContactRowExtended = ContactRow & {
  linkedin_url?: string | null;
  source?: string | null;
  confidence?: number | null;
  last_verified?: string | null;
};

export function mapContactRowToDomain(row: ContactRowExtended): Contact {
  return {
    id: toContactId(row.id),
    organizationId: row.organization_id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    jobTitle: row.job_title,
    linkedinUrl: row.linkedin_url ?? null,
    source: row.source ?? null,
    confidence: row.confidence ?? null,
    lastVerified: row.last_verified ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type ContactInsertRow = {
  organization_id: string;
  company_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  linkedin_url: string | null;
  source: string | null;
  confidence: number | null;
  last_verified: string | null;
};

export function mapCreateInputToRow(
  organizationId: string,
  input: {
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
  },
): ContactInsertRow {
  return {
    organization_id: organizationId,
    company_id: input.companyId,
    first_name: input.firstName,
    last_name: input.lastName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    job_title: input.jobTitle ?? null,
    linkedin_url: input.linkedinUrl ?? null,
    source: input.source ?? null,
    confidence: input.confidence ?? null,
    last_verified: input.lastVerified ?? null,
  };
}

export function mapContactIdToString(contactId: Contact["id"]): string {
  return contactId;
}
