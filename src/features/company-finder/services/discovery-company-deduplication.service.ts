import "server-only";

import type { Company, UpdateCompanyInput } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import { buildQualifiedDiscoveryCreateInput } from "@/features/company-finder/services/discovery-save";
import { validateDiscoveryCompanyForSave } from "@/features/company-finder/discovery/discovery-company-save-validation";
import { mergeLeadFields } from "@/features/companies/repositories/company.mapper";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { matchAgainstExisting } from "@/features/lead-intelligence/services/dedupe";
import type { LeadIntelligenceContext } from "@/features/lead-intelligence/services/lead-intelligence-engine.service";

const DEDUPE_PAGE_SIZE = 100;

export async function loadExistingCompaniesForDedupe(
  companiesService: CompaniesService,
  context: LeadIntelligenceContext,
): Promise<Company[]> {
  const existingCompanies: Company[] = [];
  let offset = 0;

  while (true) {
    const { companies } = await companiesService.listCompanies(context, {
      limit: DEDUPE_PAGE_SIZE,
      offset,
      includeArchived: true,
    });

    existingCompanies.push(...companies);

    if (companies.length < DEDUPE_PAGE_SIZE) {
      break;
    }

    offset += DEDUPE_PAGE_SIZE;
  }

  return existingCompanies;
}

export type DiscoveryCompanySaveResult =
  | { type: "saved"; companyId: string; candidate: ExternalCompanyCandidate }
  | { type: "updated"; companyId: string; candidate: ExternalCompanyCandidate }
  | { type: "skipped"; candidate: ExternalCompanyCandidate };

export async function saveDiscoveryCompanyWithDedupe(input: {
  companiesService: CompaniesService;
  context: LeadIntelligenceContext;
  qualified: QualifiedDiscoveryCandidate;
  existingCompanies: Company[];
}): Promise<DiscoveryCompanySaveResult> {
  const { companiesService, context, qualified, existingCompanies } = input;
  const candidate = qualified.candidate;

  const saveValidation = validateDiscoveryCompanyForSave({
    name: candidate.name,
    domain: candidate.domain,
    website: candidate.website,
  });
  if (!saveValidation.acceptable) {
    return { type: "skipped", candidate };
  }

  const match = matchAgainstExisting(candidate, existingCompanies);

  if (match.isDuplicate && match.matchedCompanyId) {
    const existing = existingCompanies.find((company) => (company.id as string) === match.matchedCompanyId);

    if (existing) {
      const createInput = buildQualifiedDiscoveryCreateInput(qualified, context.userId);
      const merged = mergeLeadFields(existing, createInput);

      if (Object.keys(merged).length > 0) {
        await companiesService.updateCompany(context, existing.id, merged as UpdateCompanyInput);
      }

      return {
        type: "updated",
        companyId: existing.id as string,
        candidate,
      };
    }
  }

  const created = await companiesService.createDiscoveryCompany(
    context,
    buildQualifiedDiscoveryCreateInput(qualified, context.userId),
  );
  existingCompanies.push(created);

  return {
    type: "saved",
    companyId: created.id as string,
    candidate,
  };
}
