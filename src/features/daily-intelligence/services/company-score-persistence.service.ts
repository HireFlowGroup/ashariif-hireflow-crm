import type { SupabaseClient } from "@supabase/supabase-js";

import type { Company } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import { getPriorityEngineConfig } from "@/features/priority-engine";
import {
  priorityInputFromCandidate,
  priorityProfileToBreakdown,
} from "@/features/priority-engine/services/priority-engine.service";
import { createEmptyCandidate } from "@/features/lead-intelligence/providers/types";
import { normalizeCompanyName } from "@/features/lead-intelligence/services/recruitment-normalize";
import type { LeadScoreResult } from "@/features/lead-scoring/domain/lead-score.types";
import { computeLeadScore } from "@/features/lead-scoring/services/lead-scoring-engine.service";
import type { Database } from "@/types/database";
import type { HiringSignal } from "@/types/hiring-intelligence";
import type { Contact as ContactRow } from "@/types/crm";

export async function persistCompanyScore(
  client: SupabaseClient<Database>,
  organizationId: string,
  company: Company,
  signals: HiringSignal[],
  contacts: ContactRow[] = [],
): Promise<LeadScoreResult> {
  const candidate = buildCandidateFromCompanyAndSignals(company, signals);
  const contactPayload = contacts.map((contact) => ({
    jobTitle: contact.job_title as string | null,
    email: contact.email as string | null,
    phone: contact.phone as string | null,
    linkedinUrl: contact.linkedin_url as string | null,
    confidence: contact.confidence as number | null,
  }));

  const scoreResult = computeLeadScore(
    priorityInputFromCandidate(candidate, undefined, {
      signalCount: signals.length,
      outreachStatus: company.outreachStatus,
      contactCount: contacts.length,
      contacts: contactPayload,
    }),
  );

  const profile = scoreResult.priorityProfile!;
  const config = getPriorityEngineConfig();
  const breakdown = priorityProfileToBreakdown(profile);

  await client
    .from("company_scores")
    .update({ is_current: false } as never)
    .eq("organization_id", organizationId)
    .eq("company_id", company.id as string)
    .eq("is_current", true);

  const { data: inserted } = await client
    .from("company_scores")
    .insert({
      organization_id: organizationId,
      company_id: company.id as string,
      score: profile.compositeScore,
      priority: profile.priority,
      score_reason: profile.summary,
      score_breakdown: breakdown as never,
      model_version: config.modelVersion,
      signal_count: signals.length,
      contributing_signal_ids: signals.slice(0, 20).map((signal) => signal.id),
      is_current: true,
    } as never)
    .select("id")
    .single();

  await client
    .from("companies")
    .update({
      lead_score: profile.compositeScore,
      priority: profile.priority,
      score_reason: profile.summary,
      score_breakdown: breakdown as never,
      vacancy_count: candidate.vacancyCount,
      hiring_signals: candidate.hiringSignals.map((signal) => ({
        type: signal.type,
        description: signal.description,
        source: signal.source ?? "daily-intelligence",
        confidence: signal.confidence ?? 0.5,
      })) as never,
      current_score_id: inserted ? (inserted as { id: string }).id : null,
      last_verified_at: new Date().toISOString(),
    } as never)
    .eq("organization_id", organizationId)
    .eq("id", company.id as string);

  return scoreResult;
}

function buildCandidateFromCompanyAndSignals(
  company: Company,
  signals: HiringSignal[],
) {
  const vacancySignals = signals.filter((signal) =>
    ["vacancy", "indeed_vacancy"].includes(signal.signal_type),
  );

  return createEmptyCandidate({
    externalId: `daily:${company.id}`,
    name: company.name,
    normalizedName: normalizeCompanyName(company.name),
    website: company.website,
    domain: company.domain,
    linkedinUrl: company.linkedinUrl,
    email: company.email,
    phone: company.phone,
    city: company.city,
    region: company.region ?? company.province,
    province: company.province,
    sector: company.sector,
    source: "daily-intelligence",
    sourceUrl: company.sourceUrl,
    careersUrl: company.careersUrl,
    vacancyPageUrl: company.vacancyPageUrl,
    generalEmail: company.generalEmail,
    hrEmail: company.hrEmail,
    kvkNumber: company.kvkNumber,
    vacancyCount: vacancySignals.length,
    vacancyTitles: vacancySignals.map((signal) => signal.title ?? "").filter(Boolean),
    hiringSignals: signals.map((signal) => ({
      type: signal.signal_type,
      description: signal.description ?? signal.title ?? "",
      source: signal.source ?? signal.provider,
      confidence: signal.confidence ?? 0.5,
      importance: signal.importance,
    })),
    confidence: Math.max(...signals.map((signal) => signal.confidence ?? 0.5), 0.5),
    aiSummary: company.aiSummary,
  });
}
