import type { SupabaseClient } from "@supabase/supabase-js";

import {
  parseCompanyAnalysisSections,
} from "@/features/company-ai-analysis/domain/analysis.schema";
import type {
  CompanyAnalysisContext,
  CompanyAnalysisRecord,
} from "@/features/company-ai-analysis/domain/analysis.types";
import {
  CompanyAnalysisRepositoryError,
  type CompanyAnalysisRepository,
} from "@/features/company-ai-analysis/repositories/company-analysis.repository";
import { getSignalTypeLabel } from "@/features/hiring-intelligence/domain/signal-types";
import type { Database } from "@/types/database";
import type { AiSummary, CompanyIntelligence, HiringSignal } from "@/types/hiring-intelligence";
import type { Company as CompanyRow, Contact as ContactRow } from "@/types/crm";

const ATS_MARKERS = [
  { marker: "greenhouse.io", label: "Greenhouse" },
  { marker: "lever.co", label: "Lever" },
  { marker: "workable.com", label: "Workable" },
  { marker: "recruitee.com", label: "Recruitee" },
  { marker: "teamtailor", label: "Teamtailor" },
  { marker: "smartrecruiters", label: "SmartRecruiters" },
  { marker: "ashbyhq", label: "Ashby" },
  { marker: "bamboohr", label: "BambooHR" },
  { marker: "personio", label: "Personio" },
];

const SUMMARY_TYPE = "hiring_analysis" as const;
const MODEL_VERSION = "company-analysis-v1";

function extractAtsFromSignals(signals: HiringSignal[]): { detected: boolean; providers: string[] } {
  const providers = new Set<string>();

  for (const signal of signals) {
    const haystack = `${signal.source_url ?? ""} ${signal.description ?? ""} ${JSON.stringify(signal.payload ?? {})}`.toLowerCase();

    for (const { marker, label } of ATS_MARKERS) {
      if (haystack.includes(marker)) providers.add(label);
    }

    if (signal.signal_type === "ats_detected") {
      providers.add("ATS gedetecteerd via hiring signal");
    }
  }

  return { detected: providers.size > 0, providers: [...providers] };
}

function computeFingerprint(input: {
  signalCount: number;
  lastSignalUpdatedAt: string | null;
  scoreComputedAt: string | null;
  vacancyCount: number;
  contactCount: number;
}): string {
  return [
    input.signalCount,
    input.lastSignalUpdatedAt ?? "0",
    input.scoreComputedAt ?? "0",
    input.vacancyCount,
    input.contactCount,
  ].join("|");
}

function mapAnalysisRecord(row: AiSummary): CompanyAnalysisRecord {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const sections = parseCompanyAnalysisSections(metadata.sections ?? {});

  return {
    id: row.id,
    companyId: row.company_id,
    sections,
    model: row.model,
    generatedAt: row.generated_at,
    dataFingerprint: typeof metadata.dataFingerprint === "string" ? metadata.dataFingerprint : "",
  };
}

export class SupabaseCompanyAnalysisRepository implements CompanyAnalysisRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async loadContext(organizationId: string, companyId: string): Promise<CompanyAnalysisContext | null> {
    const [
      companyResult,
      intelligenceResult,
      signalsResult,
      vacanciesResult,
      contactsResult,
      scoreResult,
      outreachIntelligenceResult,
    ] = await Promise.all([
      this.client.from("companies").select("*").eq("organization_id", organizationId).eq("id", companyId).maybeSingle(),
      this.client.from("companies_intelligence").select("*").eq("organization_id", organizationId).eq("id", companyId).maybeSingle(),
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
        .select("id, title, status, location, source")
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
      this.client
        .from("company_scores")
        .select("computed_at")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .eq("is_current", true)
        .maybeSingle(),
      this.client
        .from("outreach_intelligence")
        .select("recommended_contact_name, recommended_contact_role, outreach_angle")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .eq("is_current", true)
        .maybeSingle(),
    ]);

    if (companyResult.error) {
      throw new CompanyAnalysisRepositoryError(companyResult.error.message);
    }

    const company = companyResult.data as CompanyRow | null;
    if (!company) return null;

    const intelligence = intelligenceResult.data as CompanyIntelligence | null;
    const signalRows = (signalsResult.data ?? []) as HiringSignal[];
    const ats = extractAtsFromSignals(signalRows);

    const lastSignalUpdatedAt =
      signalRows.length > 0
        ? signalRows.reduce((latest, signal) => {
            return signal.updated_at > latest ? signal.updated_at : latest;
          }, signalRows[0].updated_at)
        : null;

    const contacts = (contactsResult.data ?? []) as ContactRow[];
    const vacancies = vacanciesResult.data ?? [];

    const similarCompanies = await this.loadSimilarCompanies(
      organizationId,
      companyId,
      intelligence,
    );

    const dataFingerprint = computeFingerprint({
      signalCount: signalRows.length,
      lastSignalUpdatedAt,
      scoreComputedAt: (scoreResult.data as { computed_at?: string } | null)?.computed_at ?? null,
      vacancyCount: vacancies.length,
      contactCount: contacts.length,
    });

    const outreachRow = outreachIntelligenceResult.data as {
      recommended_contact_name?: string | null;
      recommended_contact_role?: string | null;
      outreach_angle?: string | null;
    } | null;

    return {
      organizationId,
      companyId,
      companyName: company.name as string,
      sector: (company.sector as string | null) ?? intelligence?.sector ?? null,
      city: (company.city as string | null) ?? intelligence?.city ?? null,
      region: (company.region as string | null) ?? (company.province as string | null) ?? null,
      website: (company.website as string | null) ?? intelligence?.website ?? null,
      domain: (company.domain as string | null) ?? intelligence?.domain ?? null,
      linkedinUrl: (company.linkedin_url as string | null) ?? intelligence?.linkedin_url ?? null,
      careersUrl: (company.careers_url as string | null) ?? null,
      vacancyPageUrl: (company.vacancy_page_url as string | null) ?? null,
      leadScore: intelligence?.current_score ?? (company.lead_score as number | null) ?? null,
      leadPriority: intelligence?.current_priority ?? (company.priority as string | null) ?? null,
      scoreReason: intelligence?.current_score_reason ?? (company.score_reason as string | null) ?? null,
      hiringIntensity: intelligence?.hiring_intensity ?? (company.hiring_intensity as number) ?? 0,
      signalCount: intelligence?.signal_count ?? signalRows.length,
      lastSignalAt: intelligence?.last_signal_at ?? signalRows[0]?.observed_at ?? null,
      atsProviders: ats.providers,
      atsDetected: ats.detected,
      signals: signalRows.map((signal) => ({
        id: signal.id,
        type: signal.signal_type,
        typeLabel: getSignalTypeLabel(signal.signal_type),
        title: signal.title,
        description: signal.description,
        source: signal.source,
        sourceUrl: signal.source_url,
        confidence: signal.confidence,
        importance: signal.importance,
        aiRelevance: signal.ai_relevance,
        observedAt: signal.observed_at,
        provider: signal.provider,
      })),
      vacancies: vacancies.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        location: (row.location as string | null) ?? null,
        source: (row.source as string | null) ?? null,
      })),
      contacts: contacts.map((row) => ({
        id: row.id as string,
        name: `${row.first_name} ${row.last_name}`.trim(),
        jobTitle: row.job_title as string | null,
        email: row.email as string | null,
        phone: row.phone as string | null,
        linkedinUrl: row.linkedin_url as string | null,
        confidence: row.confidence as number | null,
      })),
      similarCompanies,
      outreachRecommendedContact: outreachRow?.recommended_contact_name ?? null,
      outreachRecommendedRole: outreachRow?.recommended_contact_role ?? null,
      outreachAngle: outreachRow?.outreach_angle ?? null,
      dataFingerprint,
    };
  }

  async getCurrent(organizationId: string, companyId: string): Promise<CompanyAnalysisRecord | null> {
    const { data, error } = await this.client
      .from("ai_summaries")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("summary_type", SUMMARY_TYPE)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      throw new CompanyAnalysisRepositoryError(error.message);
    }

    if (!data) return null;

    return mapAnalysisRecord(data as AiSummary);
  }

  async save(
    organizationId: string,
    companyId: string,
    input: {
      sections: CompanyAnalysisRecord["sections"];
      dataFingerprint: string;
      model: string | null;
      modelVersion: string;
    },
  ): Promise<CompanyAnalysisRecord> {
    await this.client
      .from("ai_summaries")
      .update({ is_current: false } as never)
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("summary_type", SUMMARY_TYPE)
      .eq("is_current", true);

    const content = input.sections.summary;

    const { data, error } = await this.client
      .from("ai_summaries")
      .insert({
        organization_id: organizationId,
        company_id: companyId,
        summary_type: SUMMARY_TYPE,
        content,
        model: input.model,
        model_version: input.modelVersion,
        metadata: {
          sections: input.sections,
          dataFingerprint: input.dataFingerprint,
        } as never,
        is_current: true,
      } as never)
      .select("*")
      .single();

    if (error || !data) {
      throw new CompanyAnalysisRepositoryError(error?.message ?? "Analyse opslaan mislukt.");
    }

    await this.client
      .from("ai_summaries")
      .update({ is_current: false } as never)
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("summary_type", "recruitment_brief")
      .eq("is_current", true);

    await this.client.from("ai_summaries").insert({
      organization_id: organizationId,
      company_id: companyId,
      summary_type: "recruitment_brief",
      content: input.sections.summary,
      model: input.model,
      model_version: input.modelVersion,
      metadata: { source: "hiring_analysis" } as never,
      is_current: true,
    } as never);

    const summaryRow = data as AiSummary;

    await this.client
      .from("companies")
      .update({
        ai_summary: input.sections.summary,
        current_summary_id: summaryRow.id,
      } as never)
      .eq("organization_id", organizationId)
      .eq("id", companyId);

    return mapAnalysisRecord(summaryRow);
  }

  private async loadSimilarCompanies(
    organizationId: string,
    companyId: string,
    reference: CompanyIntelligence | null,
  ) {
    if (!reference) return [];

    let query = this.client
      .from("companies_intelligence")
      .select("id, name, sector, city, current_score, hiring_intensity")
      .eq("organization_id", organizationId)
      .neq("id", companyId)
      .limit(50);

    if (reference.sector) {
      query = query.ilike("sector", `%${reference.sector}%`);
    }

    const { data, error } = await query;

    if (error) return [];

    const referenceScore = reference.current_score ?? 0;
    const referenceIntensity = reference.hiring_intensity ?? 0;

    return ((data ?? []) as CompanyIntelligence[])
      .map((row) => {
        const reasons: string[] = [];
        let score = 0;

        if (reference.sector && row.sector && row.sector.toLowerCase() === reference.sector.toLowerCase()) {
          score += 40;
          reasons.push(`Zelfde sector: ${row.sector}`);
        }

        if (reference.city && row.city && row.city.toLowerCase() === reference.city.toLowerCase()) {
          score += 25;
          reasons.push(`Zelfde stad: ${row.city}`);
        }

        const scoreDelta = Math.abs((row.current_score ?? 0) - referenceScore);
        if (scoreDelta <= 15) {
          score += 15;
          reasons.push(`Vergelijkbare leadscore (${row.current_score ?? "—"})`);
        }

        const intensityDelta = Math.abs((row.hiring_intensity ?? 0) - referenceIntensity);
        if (intensityDelta <= 20) {
          score += 10;
          reasons.push(`Vergelijkbare hiring intensity (${row.hiring_intensity ?? 0})`);
        }

        return {
          id: row.id as string,
          name: row.name as string,
          sector: row.sector as string | null,
          city: row.city as string | null,
          score: row.current_score as number | null,
          hiringIntensity: row.hiring_intensity as number,
          similarityReasons: reasons,
          similarityScore: score,
        };
      })
      .filter((row) => row.similarityScore > 0)
      .sort((left, right) => right.similarityScore - left.similarityScore)
      .slice(0, 5)
      .map(({ similarityScore: _score, ...row }) => row);
  }
}

export { MODEL_VERSION as COMPANY_ANALYSIS_MODEL_VERSION };
