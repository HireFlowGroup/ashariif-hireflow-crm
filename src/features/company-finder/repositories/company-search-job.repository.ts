import type {
  CompanyFinderCriteria,
  CompanySearchJob,
  CompanySearchJobStatus,
} from "@/features/company-finder/domain";

export type CreateCompanySearchJobInput = {
  organizationId: string;
  userId: string;
  criteria: CompanyFinderCriteria;
};

export type UpdateCompanySearchJobInput = {
  status?: CompanySearchJobStatus;
  foundCount?: number;
  savedCount?: number;
  updatedCount?: number;
  skippedCount?: number;
  errorCount?: number;
  providerErrors?: Array<{ provider: string; message: string }>;
  errorMessage?: string | null;
};

export interface CompanySearchJobRepository {
  create(input: CreateCompanySearchJobInput): Promise<CompanySearchJob>;
  findById(organizationId: string, jobId: string): Promise<CompanySearchJob | null>;
  update(
    organizationId: string,
    jobId: string,
    input: UpdateCompanySearchJobInput,
  ): Promise<CompanySearchJob>;
}
