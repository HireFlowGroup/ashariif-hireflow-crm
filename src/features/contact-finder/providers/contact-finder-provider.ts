import type { Company } from "@/features/companies/domain";
import type {
  CompanyEnrichment,
  ContactFinderCriteria,
  ContactFinderProviderId,
  ExternalContactCandidate,
} from "@/features/contact-finder/domain";

export type ContactFinderProviderContext = {
  organizationId: string;
  userId: string;
  company: Company;
  enrichment: CompanyEnrichment;
  criteria: ContactFinderCriteria;
};

/** Plugin contract for external contact discovery sources. */
export interface ContactFinderProvider {
  readonly id: ContactFinderProviderId;
  readonly displayName: string;
  readonly description: string;
  search(context: ContactFinderProviderContext): Promise<ExternalContactCandidate[]>;
}
