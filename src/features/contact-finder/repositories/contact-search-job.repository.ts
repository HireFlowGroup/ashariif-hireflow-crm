import type {
  ContactFinderCriteria,
  ContactSearchJob,
  ContactSearchJobStatus,
} from "@/features/contact-finder/domain";

export type CreateContactSearchJobInput = {
  organizationId: string;
  userId: string;
  companyId: string;
  criteria: ContactFinderCriteria;
};

export type UpdateContactSearchJobInput = {
  status?: ContactSearchJobStatus;
  foundCount?: number;
  savedCount?: number;
  skippedCount?: number;
  errorCount?: number;
  errorMessage?: string | null;
};

export interface ContactSearchJobRepository {
  create(input: CreateContactSearchJobInput): Promise<ContactSearchJob>;
  findById(organizationId: string, jobId: string): Promise<ContactSearchJob | null>;
  update(
    organizationId: string,
    jobId: string,
    input: UpdateContactSearchJobInput,
  ): Promise<ContactSearchJob>;
}
