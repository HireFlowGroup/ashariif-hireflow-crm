import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  OutreachIntelligenceContext,
  OutreachIntelligenceRecord,
  OutreachScoreBreakdown,
} from "@/features/outreach-intelligence/domain/types";
import {
  OutreachIntelligenceRepositoryError,
  type OutreachIntelligenceRepository,
} from "@/features/outreach-intelligence/repositories/outreach-intelligence.repository";
import type { Database } from "@/types/database";
import type { CompanyIntelligence, HiringSignal } from "@/types/hiring-intelligence";
import type { Company as CompanyRow, Contact as ContactRow } from "@/types/crm";

type IntelligenceRow = {
  id: string;
  organization_id: string;
  company_id: string;
  outreach_id: string | null;
  recommended_contact_id: string | null;
  recommended_contact_name: string | null;
  recommended_contact_role: string | null;
  contact_score: number;
  contact_reason: string | null;
  recommended_channel: "email" | "linkedin" | "phone";
  channel_score_email: number;
  channel_score_linkedin: number;
  channel_score_phone: number;
  channel_reason: string | null;
  recommended_moment_at: string | null;
  recommended_moment_label: string | null;
  timing_reason: string | null;
  outreach_score: number;
  response_probability: number;
  score_breakdown: OutreachScoreBreakdown | Record<string, unknown>;
  draft_subject: string | null;
  draft_body: string | null;
  follow_up_subject: string | null;
  follow_up_body: string | null;
  follow_up_scheduled_at: string | null;
  hiring_signal_id: string | null;
  ai_summary_id: string | null;
  model: string | null;
  computed_at: string;
};

function mapRow(row: IntelligenceRow): OutreachIntelligenceRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    companyId: row.company_id,
    outreachId: row.outreach_id,
    recommendedContactId: row.recommended_contact_id,
    recommendedContactName: row.recommended_contact_name,
    recommendedContactRole: row.recommended_contact_role,
    contactScore: row.contact_score,
    contactReason: row.contact_reason,
    recommendedChannel: row.recommended_channel,
    channelScores: {
      email: row.channel_score_email,
      linkedin: row.channel_score_linkedin,
      phone: row.channel_score_phone,
    },
    channelReason: row.channel_reason,
    recommendedMomentAt: row.recommended_moment_at,
    recommendedMomentLabel: row.recommended_moment_label,
    timingReason: row.timing_reason,
    outreachScore: row.outreach_score,
    responseProbability: row.response_probability,
    scoreBreakdown: (row.score_breakdown ?? {}) as OutreachScoreBreakdown,
    draftSubject: row.draft_subject,
    draftBody: row.draft_body,
    followUpSubject: row.follow_up_subject,
    followUpBody: row.follow_up_body,
    followUpScheduledAt: row.follow_up_scheduled_at,
    hiringSignalId: row.hiring_signal_id,
    aiSummaryId: row.ai_summary_id,
    model: row.model,
    computedAt: row.computed_at,
  };
}

export class SupabaseOutreachIntelligenceRepository implements OutreachIntelligenceRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async loadContext(organizationId: string, companyId: string): Promise<OutreachIntelligenceContext | null> {
    const [companyResult, intelligenceResult, contactsResult, signalsResult, vacanciesResult] =
      await Promise.all([
        this.client
          .from("companies")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("id", companyId)
          .maybeSingle(),
        this.client
          .from("companies_intelligence")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("id", companyId)
          .maybeSingle(),
        this.client
          .from("contacts")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        this.client
          .from("hiring_signals")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .order("observed_at", { ascending: false })
          .limit(10),
        this.client
          .from("vacancies")
          .select("id, title, created_at")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .neq("status", "closed"),
      ]);

    if (companyResult.error) {
      throw new OutreachIntelligenceRepositoryError(companyResult.error.message);
    }

    const company = companyResult.data as CompanyRow | null;
    if (!company) return null;

    const intelligence = intelligenceResult.data as CompanyIntelligence | null;
    const contacts = (contactsResult.data ?? []) as ContactRow[];
    const signals = (signalsResult.data ?? []) as HiringSignal[];
    const vacancies = vacanciesResult.data ?? [];

    return {
      organizationId,
      userId: "",
      companyId,
      companyName: company.name as string,
      sector: (company.sector as string | null) ?? intelligence?.sector ?? null,
      city: (company.city as string | null) ?? intelligence?.city ?? null,
      website: (company.website as string | null) ?? intelligence?.website ?? null,
      linkedinUrl: (company.linkedin_url as string | null) ?? intelligence?.linkedin_url ?? null,
      email: (company.email as string | null) ?? (company.general_email as string | null) ?? null,
      phone: company.phone as string | null,
      leadScore: intelligence?.current_score ?? (company.lead_score as number | null) ?? null,
      leadPriority: intelligence?.current_priority ?? (company.priority as string | null) ?? null,
      hiringIntensity: intelligence?.hiring_intensity ?? (company.hiring_intensity as number) ?? 0,
      signalCount: intelligence?.signal_count ?? signals.length,
      lastSignalAt: intelligence?.last_signal_at ?? signals[0]?.observed_at ?? null,
      aiSummary: intelligence?.current_ai_summary ?? (company.ai_summary as string | null) ?? null,
      vacancyCount: vacancies.length,
      contacts: contacts.map((row) => ({
        id: row.id as string,
        firstName: row.first_name as string,
        lastName: row.last_name as string,
        email: row.email as string | null,
        phone: row.phone as string | null,
        jobTitle: row.job_title as string | null,
        linkedinUrl: row.linkedin_url as string | null,
        confidence: row.confidence as number | null,
      })),
      signals: signals.map((row) => ({
        id: row.id,
        signalType: row.signal_type,
        title: row.title,
        description: row.description,
        observedAt: row.observed_at,
        importance: row.importance,
      })),
      vacancies: vacancies.map((row) => ({
        id: row.id as string,
        title: row.title as string,
        createdAt: row.created_at as string,
      })),
    };
  }

  async getCurrent(organizationId: string, companyId: string): Promise<OutreachIntelligenceRecord | null> {
    const { data, error } = await this.client
      .from("outreach_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .eq("is_current", true)
      .maybeSingle();

    if (error) {
      if (error.code === "42P01") return null;
      throw new OutreachIntelligenceRepositoryError(error.message);
    }

    return data ? mapRow(data as IntelligenceRow) : null;
  }

  async save(
    record: Omit<OutreachIntelligenceRecord, "id" | "computedAt"> & { id?: string },
  ): Promise<OutreachIntelligenceRecord> {
    await this.client
      .from("outreach_intelligence")
      .update({ is_current: false, updated_at: new Date().toISOString() })
      .eq("organization_id", record.organizationId)
      .eq("company_id", record.companyId)
      .eq("is_current", true);

    const row = {
      organization_id: record.organizationId,
      company_id: record.companyId,
      outreach_id: record.outreachId,
      recommended_contact_id: record.recommendedContactId,
      recommended_contact_name: record.recommendedContactName,
      recommended_contact_role: record.recommendedContactRole,
      contact_score: record.contactScore,
      contact_reason: record.contactReason,
      recommended_channel: record.recommendedChannel,
      channel_score_email: record.channelScores.email,
      channel_score_linkedin: record.channelScores.linkedin,
      channel_score_phone: record.channelScores.phone,
      channel_reason: record.channelReason,
      recommended_moment_at: record.recommendedMomentAt,
      recommended_moment_label: record.recommendedMomentLabel,
      timing_reason: record.timingReason,
      outreach_score: record.outreachScore,
      response_probability: record.responseProbability,
      score_breakdown: record.scoreBreakdown,
      draft_subject: record.draftSubject,
      draft_body: record.draftBody,
      follow_up_subject: record.followUpSubject,
      follow_up_body: record.followUpBody,
      follow_up_scheduled_at: record.followUpScheduledAt,
      hiring_signal_id: record.hiringSignalId,
      ai_summary_id: record.aiSummaryId,
      model: record.model,
      is_current: true,
      computed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from("outreach_intelligence")
      .insert(row)
      .select("*")
      .single();

    if (error) {
      throw new OutreachIntelligenceRepositoryError(error.message);
    }

    return mapRow(data as IntelligenceRow);
  }

  async upsertOutreachDraft(input: {
    organizationId: string;
    companyId: string;
    userId: string;
    contactId: string | null;
    hiringSignalId: string | null;
    suggestedContactRole: string | null;
    outreachAngle: string;
    draftSubject: string;
    draftBody: string;
    followUpScheduledAt: string;
  }): Promise<string | null> {
    const { data: existing } = await this.client
      .from("outreach")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("company_id", input.companyId)
      .in("status", ["draft", "review", "queued"])
      .maybeSingle();

    const payload = {
      contact_id: input.contactId,
      hiring_signal_id: input.hiringSignalId,
      suggested_contact_role: input.suggestedContactRole,
      outreach_angle: input.outreachAngle,
      message_subject: input.draftSubject,
      message_body: input.draftBody,
      scheduled_at: input.followUpScheduledAt,
      ai_summary_id: null,
      sent_at: null,
      status: "draft" as const,
      review_required: true,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { data, error } = await this.client
        .from("outreach")
        .update(payload)
        .eq("id", existing.id as string)
        .select("id")
        .single();

      if (error) throw new OutreachIntelligenceRepositoryError(error.message);
      await this.syncCompanyOutreachStatus(input.organizationId, input.companyId, "draft");
      return (data?.id as string) ?? null;
    }

    const { data, error } = await this.client
      .from("outreach")
      .insert({
        organization_id: input.organizationId,
        company_id: input.companyId,
        user_id: input.userId,
        ...payload,
      })
      .select("id")
      .single();

    if (error) throw new OutreachIntelligenceRepositoryError(error.message);

    await this.syncCompanyOutreachStatus(input.organizationId, input.companyId, "draft");
    return (data?.id as string) ?? null;
  }

  private async syncCompanyOutreachStatus(
    organizationId: string,
    companyId: string,
    status: string,
  ): Promise<void> {
    await this.client
      .from("companies")
      .update({ outreach_status: status, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId)
      .eq("id", companyId);
  }
}
