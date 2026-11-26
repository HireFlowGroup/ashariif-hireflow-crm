import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, UpdateCompanyInput } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import { buildQualifiedDiscoveryCreateInput } from "@/features/company-finder/services/discovery-save";
import { validateDiscoveryCompanyForSave } from "@/features/company-finder/discovery/discovery-company-save-validation";
import { mergeLeadFields } from "@/features/companies/repositories/company.mapper";
import type { ExternalCompanyCandidate } from "@/features/lead-intelligence/domain";
import { matchAgainstExisting } from "@/features/lead-intelligence/services/dedupe";
import type { LeadIntelligenceContext } from "@/features/lead-intelligence/services/lead-intelligence-engine.service";
import { persistDiscoveryCompanySecure } from "@/features/company-finder/services/secure-discovery-company-persistence.service";
import {
  releaseAiRecruiterRunSlot,
  reserveAiRecruiterRunSlot,
} from "@/features/ai-recruiter/services/run-slot-persistence.service";
import { DatabaseIntegrityUnavailableError } from "@/features/ai-recruiter/services/database-integrity.errors";
import { createClient } from "@/lib/supabase/server";

const DEDUPE_PAGE_SIZE = 100;

export type DiscoveryCompanyRunPersistenceContext = {
  organizationId: string;
  runId: string;
  maximumCompanies: number;
  maximumDrafts?: number;
  client?: SupabaseClient | null;
};

const DB_GUARANTEES: { requireDatabaseGuarantees: true } = { requireDatabaseGuarantees: true };

/** Maps slow-path lead candidates into the qualified shape used by secure dedupe. */
export function leadCandidateToQualifiedDiscovery(
  candidate: ExternalCompanyCandidate,
  sourceProvider = "lead_intelligence",
): QualifiedDiscoveryCandidate {
  return {
    candidate,
    companyType: "company_website",
    companyConfidence: 70,
    discoveryReason: "slow_finder",
    discoveryProvider: sourceProvider,
    urlCategory: "company",
    homepageSignalCount: 0,
    saveStatus: "company",
  };
}

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
  runPersistence?: DiscoveryCompanyRunPersistenceContext | null;
}): Promise<DiscoveryCompanySaveResult> {
  const { companiesService, context, qualified, existingCompanies, runPersistence } = input;
  const candidate = qualified.candidate;

  const saveValidation = validateDiscoveryCompanyForSave({
    name: candidate.name,
    domain: candidate.domain,
    website: candidate.website,
  });
  if (!saveValidation.acceptable) {
    return { type: "skipped", candidate };
  }

  const createInput = buildQualifiedDiscoveryCreateInput(qualified, context.userId);
  let persistenceClient: SupabaseClient | null = runPersistence?.client ?? null;
  let slotReserved = false;

  if (runPersistence) {
    persistenceClient = runPersistence.client ?? (await createClient());
    const slot = await reserveAiRecruiterRunSlot(
      persistenceClient,
      "company",
      {
        organizationId: runPersistence.organizationId,
        runId: runPersistence.runId,
        caps: {
          maximumCompanies: runPersistence.maximumCompanies,
          maximumDrafts: runPersistence.maximumDrafts ?? 0,
        },
      },
      DB_GUARANTEES,
    );
    if (!slot.reserved) {
      throw new DatabaseIntegrityUnavailableError(
        "Database-slot niet gereserveerd (cap of RPC-weigering) — opslaan gestopt.",
        "slot_not_reserved",
      );
    }
    slotReserved = true;
  }

  const match = matchAgainstExisting(candidate, existingCompanies);

  if (match.isDuplicate && match.matchedCompanyId) {
    const existing = existingCompanies.find((company) => (company.id as string) === match.matchedCompanyId);

    if (existing) {
      const merged = mergeLeadFields(existing, createInput);

      const updatePayload = Object.fromEntries(
        Object.entries(merged).filter(([, value]) => value !== undefined && value !== null),
      ) as UpdateCompanyInput;

      try {
        if (Object.keys(updatePayload).length > 0) {
          try {
            await companiesService.updateCompany(context, existing.id, updatePayload);
          } catch (error) {
            const message = error instanceof Error ? error.message : "Update mislukt";
            if (!/minimaal één veld/i.test(message)) {
              throw error;
            }
          }
        }

        return {
          type: "updated",
          companyId: existing.id as string,
          candidate,
        };
      } catch (error) {
        if (runPersistence && slotReserved) {
          await releaseAiRecruiterRunSlot(
            persistenceClient,
            "company",
            {
              organizationId: runPersistence.organizationId,
              runId: runPersistence.runId,
            },
            DB_GUARANTEES,
          );
        }
        throw error;
      }
    }
  }

  try {
    const persisted = await persistDiscoveryCompanySecure({
      client: persistenceClient,
      companiesService,
      context,
      createInput,
      requireDatabaseGuarantees: Boolean(runPersistence),
    });
    const company = persisted.company;
    existingCompanies.push(company);

    return {
      type: "saved",
      companyId: company.id as string,
      candidate,
    };
  } catch (error) {
    if (runPersistence && slotReserved) {
      await releaseAiRecruiterRunSlot(
        persistenceClient,
        "company",
        {
          organizationId: runPersistence.organizationId,
          runId: runPersistence.runId,
        },
        DB_GUARANTEES,
      );
    }
    throw error;
  }
}