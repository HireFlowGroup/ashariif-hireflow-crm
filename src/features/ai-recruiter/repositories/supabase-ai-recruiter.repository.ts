import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AiRecruiterRun,
  AiRecruiterRunItem,
  AiRecruiterRunSettings,
  AiRecruiterRunStatus,
  AiRecruiterScoreBreakdown,
  CreateAiRecruiterRunInput,
  ReplyClassification,
} from "@/features/ai-recruiter/domain/types";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import {
  createInitialCounters,
  createInitialPipelineSteps,
} from "@/features/ai-recruiter/domain/types";
import type { AiRecruiterRepository } from "@/features/ai-recruiter/repositories/ai-recruiter.repository";

function mapRun(row: Record<string, unknown>): AiRecruiterRun {
  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    createdBy: row.created_by as string,
    name: row.name as string,
    prompt: row.prompt as string,
    status: row.status as AiRecruiterRunStatus,
    searchCriteria: row.search_criteria as AiRecruiterRun["searchCriteria"],
    settings: row.settings as AiRecruiterRunSettings,
    counters: (row.counters as AiRecruiterRun["counters"]) ?? createInitialCounters(),
    pipelineSteps: (row.pipeline_steps as AiRecruiterRun["pipelineSteps"]) ?? createInitialPipelineSteps(),
    startedAt: (row.started_at as string) ?? null,
    completedAt: (row.completed_at as string) ?? null,
    errorMessage: (row.error_message as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapItem(row: Record<string, unknown>): AiRecruiterRunItem {
  const companies = row.companies as { name: string; city: string | null; sector: string | null } | null;
  const contacts = row.contacts as {
    first_name: string;
    last_name: string;
    email: string | null;
    job_title: string | null;
    linkedin_url: string | null;
    verification_status: string | null;
    source_type: string | null;
    relevance_score: number | null;
    confidence: number | null;
    is_general_mailbox: boolean | null;
  } | null;
  const messages = row.outreach_messages as { subject: string; recipient_email: string } | null;
  const externalCompanyData = (row.external_company_data as Record<string, unknown>) ?? {};
  const contactDiscovery = externalCompanyData.contactDiscovery as
    | {
        selected?: SelectedDiscoveredContact;
        alternatives?: SelectedDiscoveredContact[];
        errorMessage?: string | null;
      }
    | undefined;

  const selected = contactDiscovery?.selected;

  return {
    id: row.id as string,
    organizationId: row.organization_id as string,
    runId: row.run_id as string,
    companyId: (row.company_id as string) ?? null,
    externalCompanyData,
    stage: row.stage as AiRecruiterRunItem["stage"],
    status: row.status as AiRecruiterRunItem["status"],
    discoveryScore: row.discovery_score as number | null,
    hiringScore: row.hiring_score as number | null,
    contactScore: row.contact_score as number | null,
    outreachScore: row.outreach_score as number | null,
    totalScore: row.total_score as number | null,
    scoreBreakdown: (row.score_breakdown as AiRecruiterScoreBreakdown) ?? {
      companyFit: 0,
      hiring: 0,
      opportunity: 0,
      contact: 0,
      personalization: 0,
      outreachReadiness: 0,
      explanations: [],
      opportunityWhy: [],
      salesWhy: [],
    },
    rejectionReason: (row.rejection_reason as string) ?? null,
    warnings: (row.warnings as string[]) ?? [],
    selectedContactId: (row.selected_contact_id as string) ?? null,
    outreachMessageId: (row.outreach_message_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    companyName: companies?.name,
    companyCity: companies?.city,
    companySector: companies?.sector,
    contactName:
      selected?.recipientName
      ?? (contacts ? `${contacts.first_name} ${contacts.last_name}`.trim() : undefined),
    recipientEmail: messages?.recipient_email ?? selected?.email ?? contacts?.email ?? undefined,
    draftSubject: messages?.subject,
    contactJobTitle: selected?.jobTitle ?? contacts?.job_title ?? undefined,
    contactVerificationStatus: selected?.verificationStatus ?? contacts?.verification_status ?? undefined,
    contactSourceType: selected?.sourceType ?? contacts?.source_type ?? undefined,
    contactRelevanceScore: selected?.relevanceScore ?? contacts?.relevance_score ?? undefined,
    contactSelectionReason: selected?.selectionReason,
    contactLinkedinUrl: selected?.linkedinUrl ?? contacts?.linkedin_url ?? undefined,
    contactReliabilityLevel: selected?.reliability?.level ?? undefined,
    contactReliabilityScore: selected?.reliability?.score ?? undefined,
    contactReliabilitySummary: selected?.reliability?.summary ?? undefined,
    contactRoleLabel: selected?.roleLabel ?? undefined,
    contactAlternatives: contactDiscovery?.alternatives?.map((alt) => ({
      email: alt.email,
      recipientName: alt.recipientName,
      jobTitle: alt.jobTitle,
      relevanceScore: alt.relevanceScore,
      sourceType: alt.sourceType,
      verificationStatus: alt.verificationStatus,
      isGeneralMailbox: alt.isGeneralMailbox,
      linkedinUrl: alt.linkedinUrl,
      reliabilityLevel: alt.reliability?.level,
      reliabilitySummary: alt.reliability?.summary,
      roleLabel: alt.roleLabel,
    })),
    contactDiscoveryError: contactDiscovery?.errorMessage ?? undefined,
  };
}

export class SupabaseAiRecruiterRepository implements AiRecruiterRepository {
  constructor(private readonly client: SupabaseClient) {}

  async createRun(
    organizationId: string,
    userId: string,
    input: CreateAiRecruiterRunInput,
    settings: AiRecruiterRunSettings,
  ): Promise<AiRecruiterRun> {
    const { data, error } = await this.client
      .from("ai_recruiter_runs")
      .insert({
        organization_id: organizationId,
        created_by: userId,
        name: input.name,
        prompt: input.prompt,
        status: "draft",
        search_criteria: input.searchPlan,
        settings,
        counters: createInitialCounters(),
        pipeline_steps: createInitialPipelineSteps(),
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Run kon niet worden aangemaakt.");
    return mapRun(data);
  }

  async updateRun(
    organizationId: string,
    runId: string,
    updates: Parameters<AiRecruiterRepository["updateRun"]>[2],
  ): Promise<AiRecruiterRun> {
    const row: Record<string, unknown> = {};
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.counters !== undefined) row.counters = updates.counters;
    if (updates.pipelineSteps !== undefined) row.pipeline_steps = updates.pipelineSteps;
    if (updates.startedAt !== undefined) row.started_at = updates.startedAt;
    if (updates.completedAt !== undefined) row.completed_at = updates.completedAt;
    if (updates.errorMessage !== undefined) row.error_message = updates.errorMessage;

    const { data, error } = await this.client
      .from("ai_recruiter_runs")
      .update(row)
      .eq("id", runId)
      .eq("organization_id", organizationId)
      .select("*")
      .single();

    if (error || !data) throw new Error("Run kon niet worden bijgewerkt.");
    return mapRun(data);
  }

  async getRun(organizationId: string, runId: string): Promise<AiRecruiterRun | null> {
    const { data } = await this.client
      .from("ai_recruiter_runs")
      .select("*")
      .eq("id", runId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    return data ? mapRun(data) : null;
  }

  async listRuns(organizationId: string, limit = 20): Promise<AiRecruiterRun[]> {
    const { data } = await this.client
      .from("ai_recruiter_runs")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []).map(mapRun);
  }

  async createRunItem(
    organizationId: string,
    runId: string,
    input: Parameters<AiRecruiterRepository["createRunItem"]>[2],
  ): Promise<AiRecruiterRunItem> {
    const { data, error } = await this.client
      .from("ai_recruiter_run_items")
      .insert({
        organization_id: organizationId,
        run_id: runId,
        company_id: input.companyId ?? null,
        external_company_data: input.externalCompanyData ?? {},
        stage: input.stage ?? "discovered",
        status: input.status ?? "pending",
        discovery_score: input.discoveryScore ?? null,
        rejection_reason: input.rejectionReason ?? null,
        warnings: input.warnings ?? [],
      })
      .select("*")
      .single();

    if (error || !data) throw new Error(error?.message ?? "Run item kon niet worden aangemaakt.");
    return mapItem(data);
  }

  async updateRunItem(
    organizationId: string,
    itemId: string,
    updates: Parameters<AiRecruiterRepository["updateRunItem"]>[2],
  ): Promise<AiRecruiterRunItem> {
    const row: Record<string, unknown> = {};
    if (updates.companyId !== undefined) row.company_id = updates.companyId;
    if (updates.stage !== undefined) row.stage = updates.stage;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.discoveryScore !== undefined) row.discovery_score = updates.discoveryScore;
    if (updates.hiringScore !== undefined) row.hiring_score = updates.hiringScore;
    if (updates.contactScore !== undefined) row.contact_score = updates.contactScore;
    if (updates.outreachScore !== undefined) row.outreach_score = updates.outreachScore;
    if (updates.totalScore !== undefined) row.total_score = updates.totalScore;
    if (updates.scoreBreakdown !== undefined) row.score_breakdown = updates.scoreBreakdown;
    if (updates.rejectionReason !== undefined) row.rejection_reason = updates.rejectionReason;
    if (updates.warnings !== undefined) row.warnings = updates.warnings;
    if (updates.selectedContactId !== undefined) row.selected_contact_id = updates.selectedContactId;
    if (updates.outreachMessageId !== undefined) row.outreach_message_id = updates.outreachMessageId;
    if (updates.externalCompanyData !== undefined) {
      const { data: current } = await this.client
        .from("ai_recruiter_run_items")
        .select("external_company_data")
        .eq("id", itemId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      row.external_company_data = {
        ...((current?.external_company_data as Record<string, unknown>) ?? {}),
        ...updates.externalCompanyData,
      };
    }

    const { data, error } = await this.client
      .from("ai_recruiter_run_items")
      .update(row)
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .select("*, companies(name, city, sector), contacts(first_name, last_name, email, job_title, verification_status, source_type, relevance_score, confidence, is_general_mailbox), outreach_messages(subject, recipient_email)")
      .single();

    if (error || !data) throw new Error("Run item kon niet worden bijgewerkt.");
    return mapItem(data);
  }

  async getRunItem(organizationId: string, itemId: string): Promise<AiRecruiterRunItem | null> {
    const { data } = await this.client
      .from("ai_recruiter_run_items")
      .select("*, companies(name, city, sector), contacts(first_name, last_name, email, job_title, verification_status, source_type, relevance_score, confidence, is_general_mailbox), outreach_messages(subject, recipient_email)")
      .eq("id", itemId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    return data ? mapItem(data) : null;
  }

  async listRunItems(organizationId: string, runId: string): Promise<AiRecruiterRunItem[]> {
    const { data } = await this.client
      .from("ai_recruiter_run_items")
      .select("*, companies(name, city, sector), contacts(first_name, last_name, email, job_title, verification_status, source_type, relevance_score, confidence, is_general_mailbox), outreach_messages(subject, recipient_email)")
      .eq("organization_id", organizationId)
      .eq("run_id", runId)
      .order("total_score", { ascending: false, nullsFirst: false });

    return (data ?? []).map(mapItem);
  }

  async saveReply(
    organizationId: string,
    input: {
      outreachMessageId: string;
      runItemId?: string | null;
      classification: ReplyClassification;
      replySubject?: string | null;
      replySnippet?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void> {
    await this.client.from("ai_recruiter_replies").insert({
      organization_id: organizationId,
      outreach_message_id: input.outreachMessageId,
      run_item_id: input.runItemId ?? null,
      classification: input.classification,
      reply_subject: input.replySubject ?? null,
      reply_snippet: input.replySnippet ?? null,
      metadata: input.metadata ?? {},
    });
  }
}
