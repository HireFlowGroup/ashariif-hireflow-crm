import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { Company } from "@/features/companies/domain";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import type { Database } from "@/types/database";

export type PersistProspectDecisionInput = {
  organizationId: string;
  runId: string;
  runItemId: string;
  company: Company | null;
  eligibility: ConceptEligibilityResult;
  vacancies: VacancyEvidence[];
  contact: SelectedDiscoveredContact | null;
  contactStage: string;
  conceptStatus: "pending" | "created" | "skipped" | "failed";
  manualEligibilityOverride?: boolean;
  sourceUrl?: string | null;
  sourceType?: string | null;
};

type ProspectDecisionRow = Record<string, unknown>;

export class ProspectAuditRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private auditTable() {
    return this.client as SupabaseClient;
  }

  async upsertDecision(input: PersistProspectDecisionInput): Promise<void> {
    const primaryVacancy = input.vacancies[0] ?? null;
    const row: ProspectDecisionRow = {
      organization_id: input.organizationId,
      run_id: input.runId,
      run_item_id: input.runItemId,
      company_id: input.company?.id ?? null,
      company_name: input.company?.name ?? "Onbekend",
      company_domain: input.company?.domain ?? input.company?.website ?? null,
      source_url: input.sourceUrl ?? input.company?.sourceUrl ?? null,
      source_type: input.sourceType ?? null,
      vacancy_title: primaryVacancy?.title ?? null,
      vacancy_url: primaryVacancy?.sourceUrl ?? null,
      vacancy_source: primaryVacancy?.sourceDomain ?? null,
      location: input.company?.city ?? primaryVacancy?.location ?? null,
      sector: input.company?.sector ?? null,
      employee_range: input.company?.employeeCountLabel ?? null,
      company_validation_status: input.company ? "validated" : null,
      vacancy_validation_status: input.vacancies.length > 0 ? "found" : "none",
      contact_type: input.contact?.isGeneralMailbox ? "general_mailbox" : input.contact ? "personal" : null,
      contact_email: input.contact?.email ?? null,
      contact_verification_status: input.contact?.verificationStatus ?? null,
      contact_score: input.eligibility.score,
      opportunity_score: input.eligibility.score,
      deterministic_score: input.eligibility.score,
      eligibility_status: input.eligibility.eligible || input.manualEligibilityOverride
        ? input.manualEligibilityOverride
          ? "manual_override"
          : "eligible"
        : "ineligible",
      concept_status: input.conceptStatus,
      accepted_rules: input.eligibility.acceptedRules,
      rejected_rules: input.eligibility.rejectedRules,
      final_decision: input.eligibility.eligible ? "eligible" : "rejected",
      final_reason: input.eligibility.userMessage,
      reason_code: input.eligibility.reasonCode,
      manual_eligibility_override: input.manualEligibilityOverride ?? false,
      vacancy_evidence: input.vacancies,
      updated_at: new Date().toISOString(),
    };

    const { error } = await this.auditTable()
      .from("ai_recruiter_prospect_decisions")
      .upsert(row, { onConflict: "run_item_id" });

    if (error) {
      console.error("[ProspectAudit] upsert failed", { runItemId: input.runItemId, error: error.message });
    }
  }

  async listByRun(organizationId: string, runId: string) {
    const { data, error } = await this.auditTable()
      .from("ai_recruiter_prospect_decisions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("run_id", runId)
      .order("created_at", { ascending: true });

    if (error) throw error;
    return data ?? [];
  }
}
