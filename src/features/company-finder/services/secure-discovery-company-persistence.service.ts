import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company } from "@/features/companies/domain";
import type { CreateCompanyInput } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import type { CompaniesServiceContext } from "@/features/companies/services/companies.service";
import { canonicalDomainForStorage } from "@/features/company-finder/discovery/canonical-domain-storage.service";
import {
  mapCompanyRowToDomain,
  mergeLeadFields,
} from "@/features/companies/repositories/company.mapper";
import type { UpdateCompanyInput } from "@/features/companies/domain";
import type { Company as CompanyRow } from "@/types/crm";
import { DatabaseIntegrityUnavailableError } from "@/features/ai-recruiter/services/database-integrity.errors";

export type DiscoveryCompanyPersistResult =
  | { type: "inserted"; company: Company }
  | { type: "upserted"; company: Company }
  | { type: "fallback_create"; company: Company };

export async function persistDiscoveryCompanySecure(input: {
  client: SupabaseClient | null;
  companiesService: CompaniesService;
  context: CompaniesServiceContext;
  createInput: CreateCompanyInput;
  requireDatabaseGuarantees?: boolean;
}): Promise<DiscoveryCompanyPersistResult> {
  const requireDb = input.requireDatabaseGuarantees === true;

  if (requireDb && !input.client) {
    throw new DatabaseIntegrityUnavailableError(
      "Veilige company-upsert vereist maar er is geen Supabase-client.",
      "missing_supabase_client",
    );
  }
  const canonical = canonicalDomainForStorage({
    website: input.createInput.website,
    domain: input.createInput.domain,
  });

  const payload = {
    name: input.createInput.name,
    website: input.createInput.website,
    domain: input.createInput.domain ?? canonical,
    status: input.createInput.status ?? "prospect",
    city: input.createInput.city,
    sector: input.createInput.sector,
    source: input.createInput.source,
    source_url: input.createInput.sourceUrl,
    owner_id: input.context.userId,
  };

  const tryRpc = Boolean(input.client);

  if (tryRpc) {
    const { data, error } = await input.client!.rpc("upsert_discovery_company", {
      p_organization_id: input.context.organizationId,
      p_canonical_domain: canonical,
      p_payload: payload,
    });

    if (!error && data) {
      let company = mapCompanyRowToDomain(data as CompanyRow, input.context.userId);
      const merged = mergeLeadFields(company, input.createInput);
      const evidencePatch = Object.fromEntries(
        Object.entries(merged).filter(([, value]) => value !== undefined && value !== null),
      ) as UpdateCompanyInput;

      if (Object.keys(evidencePatch).length > 0) {
        company = await input.companiesService.updateCompany(
          input.context,
          company.id,
          evidencePatch,
        );
      }

      return { type: "upserted", company };
    }

    const missingFn =
      error?.code === "PGRST202"
      || /could not find the function/i.test(error?.message ?? "");

    if (error && !missingFn) {
      const duplicate =
        error.code === "23505"
        || /duplicate key/i.test(error.message ?? "");
      if (duplicate) {
        throw new Error(`canonical_domain conflict voor ${canonical}`);
      }
      throw new Error(error.message ?? "upsert_discovery_company mislukt");
    }

    if (requireDb && missingFn) {
      throw new DatabaseIntegrityUnavailableError(
        "upsert_discovery_company ontbreekt op de database — AI Recruiter persistence gestopt.",
        "missing_rpc_function",
      );
    }
  }

  if (requireDb) {
    throw new DatabaseIntegrityUnavailableError(
      "Veilige company-upsert kon niet via database worden afgerond.",
      "missing_rpc_function",
    );
  }

  const enrichedInput: CreateCompanyInput = {
    ...input.createInput,
    domain: input.createInput.domain ?? canonical,
  };

  const company = await input.companiesService.createDiscoveryCompany(input.context, enrichedInput);
  return { type: "fallback_create", company };
}