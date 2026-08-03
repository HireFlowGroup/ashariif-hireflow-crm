import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  CompanyActivityItem,
  CompanyDigitalPresence,
  CompanyHiringSignalItem,
  CompanyNewsItem,
  CompanyOutreachItem,
  CompanyOutreachIntelligence,
  CompanyPageData,
  CompanyPageIntelligence,
  CompanyTaskItem,
  CompanyTimelineEvent,
  CompanyVacancyItem,
} from "@/features/company-intelligence/domain/company-page.types";
import {
  CompanyPageRepositoryError,
  type CompanyPageRepository,
} from "@/features/company-intelligence/repositories/company-page.repository";
import type { Company } from "@/features/companies/domain";
import { mapCompanyRowToDomain } from "@/features/companies/repositories/company.mapper";
import { getSignalTypeLabel } from "@/features/hiring-intelligence/domain/signal-types";
import { PRIORITY_COMPONENT_LABELS_NL } from "@/features/priority-engine";
import { parsePriorityBreakdown } from "@/features/priority-engine/services/parse-priority-breakdown";
import { parseScoreComponents } from "@/lib/companies/scorecard";
import { serializeContactForList } from "@/lib/contacts/format";
import type { Database } from "@/types/database";
import type { CompanyIntelligence, HiringSignal } from "@/types/hiring-intelligence";
import type { Contact as ContactRow, Company as CompanyRow } from "@/types/crm";

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

const TECH_MARKERS = [
  "react",
  "node",
  "python",
  "java",
  "aws",
  "azure",
  "kubernetes",
  "salesforce",
  "hubspot",
  "wordpress",
];

function mapSignal(signal: HiringSignal): CompanyHiringSignalItem {
  return {
    id: signal.id,
    type: signal.signal_type,
    typeLabel: getSignalTypeLabel(signal.signal_type),
    title: signal.title,
    description: signal.description,
    source: signal.source,
    sourceUrl: signal.source_url,
    confidence: signal.confidence,
    importance: signal.importance,
    observedAt: signal.observed_at,
  };
}

function extractAtsFromSignals(signals: HiringSignal[]): { detected: boolean; providers: string[] } {
  const providers = new Set<string>();

  for (const signal of signals) {
    const haystack = `${signal.source_url ?? ""} ${signal.description ?? ""} ${JSON.stringify(signal.payload ?? {})}`.toLowerCase();

    for (const { marker, label } of ATS_MARKERS) {
      if (haystack.includes(marker)) providers.add(label);
    }

    if (signal.signal_type === "ats_detected") {
      providers.add("ATS gedetecteerd");
    }
  }

  return { detected: providers.size > 0, providers: [...providers] };
}

function extractTechnologies(signals: HiringSignal[], domain: string | null): string[] {
  const tech = new Set<string>();
  const haystack = signals
    .map((signal) => `${signal.description ?? ""} ${JSON.stringify(signal.payload ?? {})}`)
    .join(" ")
    .toLowerCase();

  for (const marker of TECH_MARKERS) {
    if (haystack.includes(marker)) {
      tech.add(marker.charAt(0).toUpperCase() + marker.slice(1));
    }
  }

  if (domain) tech.add(domain);

  return [...tech].slice(0, 8);
}

function buildTimeline(input: {
  signals: CompanyHiringSignalItem[];
  vacancies: CompanyVacancyItem[];
  outreach: CompanyOutreachItem[];
  tasks: CompanyTaskItem[];
  companyCreatedAt: string;
  companyName: string;
}): CompanyTimelineEvent[] {
  const events: CompanyTimelineEvent[] = [
    {
      id: "company-created",
      type: "company",
      title: `${input.companyName} toegevoegd`,
      description: "Bedrijf opgenomen in HireFlow intelligence",
      occurredAt: input.companyCreatedAt,
    },
    ...input.signals.map((signal) => ({
      id: `signal-${signal.id}`,
      type: "signal" as const,
      title: signal.title ?? signal.typeLabel,
      description: signal.description,
      occurredAt: signal.observedAt,
      meta: signal.typeLabel,
    })),
    ...input.vacancies.map((vacancy) => ({
      id: `vacancy-${vacancy.id}`,
      type: "vacancy" as const,
      title: vacancy.title,
      description: vacancy.location,
      occurredAt: vacancy.createdAt,
      meta: vacancy.status,
      href: `/vacancies/${vacancy.id}`,
    })),
    ...input.outreach.map((item) => ({
      id: `outreach-${item.id}`,
      type: "outreach" as const,
      title: `Outreach — ${item.status}`,
      description: item.outreachAngle,
      occurredAt: item.createdAt,
      meta: item.suggestedContactRole,
    })),
    ...input.tasks.map((task) => ({
      id: `task-${task.id}`,
      type: "task" as const,
      title: task.title,
      description: task.description,
      occurredAt: task.createdAt,
      meta: task.status,
      href: "/tasks",
    })),
  ];

  return events.sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

function buildActivity(timeline: CompanyTimelineEvent[]): CompanyActivityItem[] {
  return timeline.slice(0, 25).map((event) => ({
    id: event.id,
    type: event.type,
    title: event.title,
    description: event.description,
    occurredAt: event.occurredAt,
    href: event.href,
  }));
}

export class SupabaseCompanyPageRepository implements CompanyPageRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async loadPageData(organizationId: string, companyId: string): Promise<CompanyPageData | null> {
    try {
      const { data: companyRow, error: companyError } = await this.client
        .from("companies")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("id", companyId)
        .maybeSingle();

      if (companyError || !companyRow) return null;

      const company = mapCompanyRowToDomain(companyRow as CompanyRow, null);

      const [
        intelligenceResult,
        signalsResult,
        vacanciesResult,
        contactsResult,
        outreachResult,
        tasksResult,
        scoreResult,
        outreachIntelligenceResult,
      ] = await Promise.all([
        this.client
          .from("companies_intelligence")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("id", companyId)
          .maybeSingle(),
        this.client
          .from("hiring_signals")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .order("observed_at", { ascending: false }),
        this.client
          .from("vacancies")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .order("updated_at", { ascending: false }),
        this.client
          .from("contacts")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        this.client
          .from("outreach")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .order("created_at", { ascending: false }),
        this.client
          .from("tasks")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("related_type", "company")
          .eq("related_id", companyId)
          .neq("status", "done")
          .order("due_at", { ascending: true, nullsFirst: false }),
        this.client
          .from("company_scores")
          .select("score_breakdown, score, priority, score_reason, model_version")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .eq("is_current", true)
          .maybeSingle(),
        this.client
          .from("outreach_intelligence")
          .select("*")
          .eq("organization_id", organizationId)
          .eq("company_id", companyId)
          .eq("is_current", true)
          .maybeSingle(),
      ]);

      const intelligenceRow = intelligenceResult.data as CompanyIntelligence | null;
      const signalRows = (signalsResult.data ?? []) as HiringSignal[];
      const hiringSignals = signalRows.map(mapSignal);

      const news = hiringSignals
        .filter((signal) => ["news", "funding"].includes(signal.type))
        .map(
          (signal): CompanyNewsItem => ({
            id: signal.id,
            title: signal.title ?? signal.typeLabel,
            description: signal.description,
            sourceUrl: signal.sourceUrl,
            observedAt: signal.observedAt,
          }),
        );

      const vacancies: CompanyVacancyItem[] = (vacanciesResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        status: row.status as string,
        location: row.location as string | null,
        employmentType: row.employment_type as string,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
      }));

      const contacts = ((contactsResult.data ?? []) as ContactRow[]).map((row) =>
        serializeContactForList({
          id: row.id as never,
          organizationId,
          companyId: row.company_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          phone: row.phone,
          jobTitle: row.job_title,
          linkedinUrl: row.linkedin_url ?? null,
          source: row.source ?? null,
          confidence: row.confidence ?? null,
          lastVerified: row.last_verified ?? null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }),
      );

      const outreachHistory: CompanyOutreachItem[] = (outreachResult.data ?? []).map((row) => ({
        id: row.id as string,
        status: row.status as string,
        suggestedContactRole: (row.suggested_contact_role as string) ?? null,
        outreachAngle: (row.outreach_angle as string) ?? null,
        messageSubject: (row.message_subject as string) ?? null,
        messageBody: (row.message_body as string) ?? null,
        reviewRequired: row.review_required as boolean,
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
        sentAt: (row.sent_at as string) ?? null,
      }));

      const outreachIntelligenceRow = outreachIntelligenceResult.data as Record<string, unknown> | null;
      const outreachIntelligence: CompanyOutreachIntelligence | null = outreachIntelligenceRow
        ? {
            id: outreachIntelligenceRow.id as string,
            outreachId: (outreachIntelligenceRow.outreach_id as string) ?? null,
            recommendedContactId: (outreachIntelligenceRow.recommended_contact_id as string) ?? null,
            recommendedContactName: (outreachIntelligenceRow.recommended_contact_name as string) ?? null,
            recommendedContactRole: (outreachIntelligenceRow.recommended_contact_role as string) ?? null,
            contactScore: outreachIntelligenceRow.contact_score as number,
            contactReason: (outreachIntelligenceRow.contact_reason as string) ?? null,
            recommendedChannel: outreachIntelligenceRow.recommended_channel as CompanyOutreachIntelligence["recommendedChannel"],
            channelScores: {
              email: outreachIntelligenceRow.channel_score_email as number,
              linkedin: outreachIntelligenceRow.channel_score_linkedin as number,
              phone: outreachIntelligenceRow.channel_score_phone as number,
            },
            channelReason: (outreachIntelligenceRow.channel_reason as string) ?? null,
            recommendedMomentAt: (outreachIntelligenceRow.recommended_moment_at as string) ?? null,
            recommendedMomentLabel: (outreachIntelligenceRow.recommended_moment_label as string) ?? null,
            timingReason: (outreachIntelligenceRow.timing_reason as string) ?? null,
            outreachScore: outreachIntelligenceRow.outreach_score as number,
            responseProbability: outreachIntelligenceRow.response_probability as number,
            draftSubject: (outreachIntelligenceRow.draft_subject as string) ?? null,
            draftBody: (outreachIntelligenceRow.draft_body as string) ?? null,
            followUpSubject: (outreachIntelligenceRow.follow_up_subject as string) ?? null,
            followUpBody: (outreachIntelligenceRow.follow_up_body as string) ?? null,
            followUpScheduledAt: (outreachIntelligenceRow.follow_up_scheduled_at as string) ?? null,
            model: (outreachIntelligenceRow.model as string) ?? null,
            computedAt: outreachIntelligenceRow.computed_at as string,
          }
        : null;

      const openTasks: CompanyTaskItem[] = (tasksResult.data ?? []).map((row) => ({
        id: row.id as string,
        title: row.title as string,
        description: (row.description as string) ?? null,
        status: row.status as string,
        priority: (row.priority as string) ?? null,
        dueAt: (row.due_at as string) ?? null,
        createdAt: row.created_at as string,
      }));

      const ats = extractAtsFromSignals(signalRows);
      const digitalPresence: CompanyDigitalPresence = {
        website: company.website,
        domain: company.domain,
        linkedinUrl: company.linkedinUrl,
        careersUrl: company.careersUrl,
        vacancyPageUrl: company.vacancyPageUrl,
        atsDetected: ats.detected,
        atsProviders: ats.providers,
        technologies: extractTechnologies(signalRows, company.domain),
      };

      const intelligence: CompanyPageIntelligence = {
        currentScore: intelligenceRow?.current_score ?? company.leadScore,
        currentPriority: intelligenceRow?.current_priority ?? company.leadPriority,
        scoreReason: intelligenceRow?.current_score_reason ?? company.scoreReason,
        aiSummary: intelligenceRow?.current_ai_summary ?? company.aiSummary,
        hiringIntensity: intelligenceRow?.hiring_intensity ?? 0,
        signalCount: intelligenceRow?.signal_count ?? hiringSignals.length,
        lastSignalAt: intelligenceRow?.last_signal_at ?? null,
        outreachStatus: intelligenceRow?.outreach_status ?? company.outreachStatus,
      };

      const scoreRow = scoreResult.data as {
        score_breakdown?: Record<string, unknown>;
        score?: number;
        priority?: string;
        score_reason?: string;
        model_version?: string;
      } | null;
      const scoreBreakdown = scoreRow?.score_breakdown;
      const scoreComponents = parseScoreComponents(scoreBreakdown ?? company.scoreBreakdown);
      const priorityBreakdown = parsePriorityBreakdown(scoreBreakdown ?? company.scoreBreakdown);
      const priorityProfile =
        priorityBreakdown && scoreComponents
          ? {
              compositeScore: scoreRow?.score ?? intelligence.currentScore ?? 0,
              priority: (scoreRow?.priority ?? intelligence.currentPriority ?? "D") as import("@/features/priority-engine").LeadPriority,
              components: scoreComponents,
              details: priorityBreakdown.weighted.map((entry) => ({
                key: entry.key,
                label: PRIORITY_COMPONENT_LABELS_NL[entry.key],
                score: entry.rawScore,
                weight: entry.weight,
                weightedContribution: entry.weightedScore,
                factors: priorityBreakdown.factors[entry.key] ?? [],
                effectiveScore: entry.effectiveScore,
              })),
              summary: scoreRow?.score_reason ?? intelligence.scoreReason ?? "",
              modelVersion: scoreRow?.model_version ?? "priority-engine-v1",
              computedAt: new Date().toISOString(),
            }
          : null;

      const scoreExplanation =
        company.scoreReason && company.scoreReason.length > 40 && !company.scoreReason.startsWith("Priority ")
          ? company.scoreReason
          : intelligence.aiSummary;

      const timeline = buildTimeline({
        signals: hiringSignals,
        vacancies,
        outreach: outreachHistory,
        tasks: openTasks,
        companyCreatedAt: company.createdAt,
        companyName: company.name,
      });

      return {
        company,
        intelligence,
        scoreComponents,
        priorityProfile,
        scoreExplanation,
        digitalPresence,
        hiringSignals,
        news,
        vacancies,
        contacts,
        outreachHistory,
        outreachIntelligence,
        openTasks,
        timeline,
        activity: buildActivity(timeline),
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new CompanyPageRepositoryError(
        error instanceof Error ? error.message : "Bedrijfspagina laden mislukt.",
      );
    }
  }
}
