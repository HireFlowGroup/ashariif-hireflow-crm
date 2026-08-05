import type { SupabaseClient } from "@supabase/supabase-js";

import { parseRecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.schema";
import type {
  RecruitmentIntelligenceAnalysis,
  RecruitmentIntelligenceInput,
  RecruitmentIntelligenceRecord,
} from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import {
  RecruitmentIntelligenceRepositoryError,
  type RecruitmentIntelligenceRepository,
} from "@/features/recruitment-intelligence/repositories/recruitment-intelligence.repository";
import {
  computeInputFingerprint,
} from "@/features/recruitment-intelligence/services/build-recruitment-intelligence-context";
import { getSignalTypeLabel } from "@/features/hiring-intelligence/domain/signal-types";
import { mapCompanyRowToDomain } from "@/features/companies/repositories/company.mapper";
import type { Database } from "@/types/database";
import type { HiringSignal } from "@/types/hiring-intelligence";
import type { Company as CompanyRow, Contact as ContactRow } from "@/types/crm";

function mapRecord(row: Record<string, unknown>): RecruitmentIntelligenceRecord {
  const analysis = parseRecruitmentIntelligenceAnalysis(row.analysis);
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    companyId: row.company_id as string,
    runItemId: (row.run_item_id as string) ?? null,
    analysis,
    inputFingerprint: row.input_fingerprint as string,
    model: (row.model as string) ?? null,
    opportunityScore:
      (row.opportunity_score as number | null) ?? analysis.recruitment_opportunity_score,
    opportunityTier:
      (row.opportunity_tier as RecruitmentIntelligenceRecord["opportunityTier"]) ?? analysis.opportunity_tier,
    generatedAt: row.created_at as string,
  };
}

function formatEmployeeLabel(company: ReturnType<typeof mapCompanyRowToDomain>): string | null {
  if (company.employeeCountLabel?.trim()) return company.employeeCountLabel.trim();
  if (company.employeeCount != null) return `${company.employeeCount} medewerkers`;
  if (company.employeeCountMin != null && company.employeeCountMax != null) {
    return `${company.employeeCountMin}–${company.employeeCountMax} medewerkers`;
  }
  return null;
}

export class SupabaseRecruitmentIntelligenceRepository implements RecruitmentIntelligenceRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private analysesTable() {
    return this.client.from("recruitment_intelligence_analyses" as never);
  }

  async loadInput(
    organizationId: string,
    companyId: string,
    runItemId: string | null = null,
  ): Promise<RecruitmentIntelligenceInput | null> {
    const { data: companyRow, error: companyError } = await this.client
      .from("companies")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("id", companyId)
      .maybeSingle();

    if (companyError || !companyRow) return null;

    const company = mapCompanyRowToDomain(companyRow as CompanyRow, null);

    const [signalsResult, vacanciesResult, contactsResult] = await Promise.all([
      this.client
        .from("hiring_signals")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .order("importance", { ascending: false })
        .order("observed_at", { ascending: false })
        .limit(40),
      this.client
        .from("vacancies")
        .select("id, title, status, location, created_at")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(30),
      this.client
        .from("contacts")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .order("confidence", { ascending: false, nullsFirst: false })
        .limit(20),
    ]);

    const signalRows = (signalsResult.data ?? []) as HiringSignal[];
    const contacts = (contactsResult.data ?? []) as ContactRow[];

    const vacancies = (vacanciesResult.data ?? []).map((row) => ({
      id: row.id as string,
      title: row.title as string,
      status: row.status as string,
      location: (row.location as string | null) ?? null,
      createdAt: (row.created_at as string | null) ?? null,
    }));

    const signals = signalRows.map((signal) => ({
      id: signal.id,
      type: signal.signal_type,
      typeLabel: getSignalTypeLabel(signal.signal_type),
      title: signal.title,
      description: signal.description,
      source: signal.source,
      observedAt: signal.observed_at,
      confidence: signal.confidence,
    }));

    const contactItems = contacts.map((row) => ({
      id: row.id as string,
      name: `${row.first_name} ${row.last_name}`.trim(),
      jobTitle: (row.job_title as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      linkedinUrl: (row.linkedin_url as string | null) ?? null,
      confidence: (row.confidence as number | null) ?? null,
    }));

    const input: RecruitmentIntelligenceInput = {
      organizationId,
      companyId,
      runItemId,
      companyName: company.name,
      website: company.website,
      domain: company.domain,
      linkedinUrl: company.linkedinUrl,
      sector: company.sector,
      city: company.city,
      region: company.region,
      employeeLabel: formatEmployeeLabel(company),
      vacancies,
      signals,
      contacts: contactItems,
      inputFingerprint: "",
    };

    input.inputFingerprint = computeInputFingerprint(input);
    return input;
  }

  async getCurrent(organizationId: string, companyId: string): Promise<RecruitmentIntelligenceRecord | null> {
    const { data, error } = await this.analysesTable()
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      throw new RecruitmentIntelligenceRepositoryError(error.message);
    }

    return data ? mapRecord(data as Record<string, unknown>) : null;
  }

  async save(
    organizationId: string,
    companyId: string,
    input: {
      analysis: RecruitmentIntelligenceAnalysis;
      inputFingerprint: string;
      model: string | null;
      runItemId?: string | null;
    },
  ): Promise<RecruitmentIntelligenceRecord> {
    await this.analysesTable()
      .update({ is_current: false, updated_at: new Date().toISOString() } as never)
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("is_current", true);

    const { data, error } = await this.analysesTable()
      .insert({
        organization_id: organizationId,
        company_id: companyId,
        run_item_id: input.runItemId ?? null,
        analysis: input.analysis,
        input_fingerprint: input.inputFingerprint,
        model: input.model,
        opportunity_score: input.analysis.recruitment_opportunity_score,
        opportunity_tier: input.analysis.opportunity_tier,
        is_current: true,
      } as never)
      .select("*")
      .single();

    if (error || !data) {
      throw new RecruitmentIntelligenceRepositoryError(error?.message ?? "Analyse opslaan mislukt.");
    }

    return mapRecord(data as Record<string, unknown>);
  }
}
