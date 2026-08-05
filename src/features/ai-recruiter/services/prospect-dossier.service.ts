import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  ProspectDossier,
  ProspectDossierContact,
  ProspectHiringSnapshot,
  ProspectOutreachHistory,
  ProspectWhyInteresting,
} from "@/features/ai-recruiter/domain/prospect-dossier.types";
import type { BdOutreachAnalysis } from "@/features/ai-recruiter/domain/types";
import type { AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import type { AiRecruiterRepository } from "@/features/ai-recruiter/repositories/ai-recruiter.repository";
import { analyzeBdOutreachContext } from "@/features/ai-recruiter/services/bd-outreach-analyzer.service";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { computeRecruitmentPainScore } from "@/features/ai-recruiter/services/recruitment-pain-score.service";
import type { CompanyPageData } from "@/features/company-intelligence/domain/company-page.types";
import { createCompanyPageService } from "@/features/company-intelligence/create-company-page-service";
import type { ExternalCompanyCandidate } from "@/features/company-finder/domain";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import type { OutreachMessage } from "@/features/outreach-engine/domain/types";
import { parseAiEmailWriterDraft } from "@/features/ai-email-writer/domain/ai-email-writer.schema";
import { formatContactName } from "@/lib/contacts/format";

const DEPT_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "Engineering", pattern: /engineer|developer|software|tech|it |data |devops|backend|frontend/i },
  { label: "Sales", pattern: /sales|account|commercial|business development|verkoop|customer success/i },
  { label: "Marketing", pattern: /marketing|content|brand|communicatie|growth/i },
  { label: "HR & Recruitment", pattern: /hr|human resources|recruiter|talent|people|werving/i },
  { label: "Operations", pattern: /operations|logistiek|supply|procurement|finance|administratie/i },
  { label: "Management", pattern: /manager|directeur|head of|lead|teamlead|ceo|cfo|cto/i },
];

function formatLocation(city: string | null, region: string | null, country: string | null): string | null {
  const parts = [city, region, country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function formatEmployees(input: {
  count: number | null;
  min: number | null;
  max: number | null;
  label: string | null;
}): string | null {
  if (input.label?.trim()) return input.label.trim();
  if (input.count != null) return `${input.count} medewerkers`;
  if (input.min != null && input.max != null) return `${input.min}–${input.max} medewerkers`;
  if (input.min != null) return `${input.min}+ medewerkers`;
  if (input.max != null) return `tot ${input.max} medewerkers`;
  return null;
}

function faviconUrl(domain: string | null, website: string | null): string | null {
  const host = domain ?? (website ? tryExtractHost(website) : null);
  if (!host) return null;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
}

function tryExtractHost(url: string): string | null {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
  } catch {
    return null;
  }
}

function inferDepartments(vacancyTitles: string[]): string[] {
  const found = new Set<string>();
  for (const title of vacancyTitles) {
    for (const { label, pattern } of DEPT_PATTERNS) {
      if (pattern.test(title)) found.add(label);
    }
  }
  return [...found];
}

function computeHiringTrend(vacancies: CompanyPageData["vacancies"]): ProspectHiringSnapshot["hiringTrend"] {
  const now = Date.now();
  const inRange = (daysAgo: number, daysAgoEnd: number) =>
    vacancies.filter((v) => {
      const age = Math.floor((now - new Date(v.createdAt).getTime()) / 86400000);
      return age >= daysAgo && age < daysAgoEnd;
    }).length;

  const last30 = inRange(0, 30);
  const prev30 = inRange(30, 60);

  if (last30 === 0 && prev30 === 0) return "onbekend";
  if (last30 > prev30) return "stijgend";
  if (last30 < prev30) return "dalend";
  return "stabiel";
}

function hiringTrendDetail(trend: ProspectHiringSnapshot["hiringTrend"], last30: number, prev30: number): string {
  switch (trend) {
    case "stijgend":
      return `${last30} nieuwe vacatures (30 d) vs ${prev30} in voorgaande periode.`;
    case "dalend":
      return `${last30} nieuwe vacatures (30 d) vs ${prev30} in voorgaande periode.`;
    case "stabiel":
      return `Gelijk aantal nieuwe vacatures (${last30}) in beide periodes.`;
    default:
      return "Onvoldoende historische vacaturedata.";
  }
}

function opportunityFromItem(item: AiRecruiterRunItem): OpportunityAssessment {
  const b = item.scoreBreakdown;
  return {
    opportunityScore: b.opportunity ?? 0,
    agencyNeedLikelihood:
      (b.opportunity ?? 0) >= 75 ? "high" : (b.opportunity ?? 0) >= 50 ? "medium" : "low",
    recruitmentPotential: b.recruitmentPotential ?? "MEDIUM",
    recruitmentPotentialMotivation: b.recruitmentPotentialMotivation ?? "",
    why: b.opportunityWhy ?? [],
    rolesSought: b.rolesSought ?? [],
    urgency: b.urgency ?? "medium",
    bestApproach: b.bestApproach ?? "",
    breakdown: {
      growth: 0,
      multipleVacancies: 0,
      noInternalRecruiter: 0,
      staleVacancies: 0,
      scalability: 0,
    },
  };
}

function buildWhyInteresting(
  bd: BdOutreachAnalysis,
  totalScore: number | null,
  opportunityScore: number,
): ProspectWhyInteresting {
  const base = totalScore ?? opportunityScore;
  const expectedOpportunityPercent = Math.min(95, Math.max(5, Math.round(base * 0.9)));

  return {
    whyInteresting: bd.whyAgency,
    whyRecruitmentHard: bd.likelyPain,
    whyHireFlowHelps: bd.whyHireFlow,
    expectedOpportunityPercent,
  };
}

async function loadOutreachHistory(
  client: SupabaseClient,
  organizationId: string,
  companyId: string,
): Promise<ProspectOutreachHistory> {
  const [messagesResult, tasksResult] = await Promise.all([
    client
      .from("outreach_messages")
      .select("status, sent_at, created_at")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .order("created_at", { ascending: false }),
    client
      .from("tasks")
      .select("id, title, status, due_at")
      .eq("organization_id", organizationId)
      .eq("related_type", "company")
      .eq("related_id", companyId)
      .neq("status", "done"),
  ]);

  const messages = messagesResult.data ?? [];
  const emailsSent = messages.filter((m) => m.status === "sent" || m.sent_at).length;
  const replies = messages.filter((m) => m.status === "replied").length;

  const tasks = tasksResult.data ?? [];
  const meetingScheduled = tasks.some(
    (t) =>
      /afspraak|meeting|gesprek|call|demo/i.test((t.title as string) ?? "")
      && t.status !== "done",
  );

  const summaryLines: string[] = [];
  if (emailsSent === 0 && replies === 0) {
    return {
      neverContacted: true,
      emailsSent: 0,
      replies: 0,
      meetingScheduled: false,
      summaryLines: ["Nog nooit benaderd"],
      lastContactAt: null,
    };
  }

  if (emailsSent > 0) {
    summaryLines.push(`${emailsSent} mail${emailsSent === 1 ? "" : "s"} verzonden`);
  }
  if (replies > 0) {
    summaryLines.push(`${replies} reactie${replies === 1 ? "" : "s"}`);
  }
  if (meetingScheduled) {
    summaryLines.push("Afspraak gepland");
  }

  const lastSent = messages.find((m) => m.sent_at)?.sent_at as string | undefined;

  return {
    neverContacted: false,
    emailsSent,
    replies,
    meetingScheduled,
    summaryLines,
    lastContactAt: lastSent ?? null,
  };
}

function buildContacts(
  pageData: CompanyPageData | null,
  item: AiRecruiterRunItem,
): ProspectDossierContact[] {
  const contacts: ProspectDossierContact[] = [];
  const selectedEmail = item.recipientEmail?.toLowerCase() ?? null;

  if (pageData) {
    for (const c of pageData.contacts) {
      const email = c.email?.toLowerCase() ?? null;
      contacts.push({
        id: c.id,
        name: formatContactName(c),
        jobTitle: c.jobTitle,
        email: c.email,
        linkedinUrl: c.linkedinUrl,
        confidence: c.confidence,
        confidenceLabel: c.confidence != null ? `${Math.round(c.confidence * 100)}%` : "—",
        source: c.source,
        isSelected: email != null && email === selectedEmail,
        isGeneralMailbox: false,
      });
    }
  }

  if (item.recipientEmail && !contacts.some((c) => c.email?.toLowerCase() === selectedEmail)) {
    contacts.unshift({
      id: item.selectedContactId,
      name: item.contactName ?? item.recipientEmail,
      jobTitle: item.contactJobTitle ?? item.contactRoleLabel ?? null,
      email: item.recipientEmail,
      linkedinUrl: item.contactLinkedinUrl ?? null,
      confidence: item.contactRelevanceScore != null ? item.contactRelevanceScore / 100 : null,
      confidenceLabel:
        item.contactReliabilityScore != null
          ? `${item.contactReliabilityScore}/100`
          : item.contactRelevanceScore != null
            ? `${item.contactRelevanceScore}%`
            : "—",
      source: item.contactSourceType ?? null,
      isSelected: true,
      isGeneralMailbox: item.stage === "general_mailbox_found",
    });
  }

  for (const alt of item.contactAlternatives ?? []) {
    if (contacts.some((c) => c.email?.toLowerCase() === alt.email.toLowerCase())) continue;
    contacts.push({
      id: null,
      name: alt.recipientName ?? alt.email,
      jobTitle: alt.roleLabel ?? alt.jobTitle,
      email: alt.email,
      linkedinUrl: alt.linkedinUrl ?? null,
      confidence: alt.relevanceScore / 100,
      confidenceLabel: `${alt.relevanceScore}%`,
      source: alt.sourceType,
      isSelected: false,
      isGeneralMailbox: alt.isGeneralMailbox,
    });
  }

  return contacts;
}

export type ProspectDossierContext = {
  organizationId: string;
  userId: string;
};

export class ProspectDossierService {
  constructor(
    private readonly repository: AiRecruiterRepository,
    private readonly supabase: SupabaseClient,
  ) {}

  async loadDossier(
    context: ProspectDossierContext,
    runId: string,
    itemId: string,
  ): Promise<ProspectDossier | null> {
    const item = await this.repository.getRunItem(context.organizationId, itemId);
    if (!item || item.runId !== runId) return null;

    const external = item.externalCompanyData;
    const candidate = external.candidate as ExternalCompanyCandidate | undefined;
    const storedBd = external.bdAnalysis as BdOutreachAnalysis | undefined;
    const followUp = external.followUpDraft as
      | { subject: string; bodyText: string; confidence?: number }
      | undefined;
    const storedEmailWriter = parseAiEmailWriterDraft(external.emailWriterDraft);

    let pageData: CompanyPageData | null = null;
    if (item.companyId) {
      const pageService = await createCompanyPageService();
      pageData = await pageService.getPageData(context, item.companyId);
    }

    const company = pageData?.company ?? null;
    const vacancies = pageData?.vacancies ?? [];
    const openVacancies = vacancies.filter((v) => v.status === "open" || v.status === "active");

    const last30 = vacancies.filter((v) => {
      const age = Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 86400000);
      return age <= 30;
    }).length;
    const prev30 = vacancies.filter((v) => {
      const age = Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 86400000);
      return age > 30 && age <= 60;
    }).length;
    const trend = computeHiringTrend(vacancies);

    const hiring: ProspectHiringSnapshot = {
      openVacancies: openVacancies.map((v) => ({
        id: v.id,
        title: v.title,
        location: v.location,
        status: v.status,
        createdAt: v.createdAt,
      })),
      departments: inferDepartments(openVacancies.map((v) => v.title)),
      newVacanciesLast30Days: last30,
      hiringTrend: trend,
      hiringTrendDetail: hiringTrendDetail(trend, last30, prev30),
    };

    let outreachMessage: OutreachMessage | null = null;
    if (item.outreachMessageId) {
      const engine = await createOutreachEngineService();
      outreachMessage = await engine.getMessage(context, item.outreachMessageId);
    }

    let bdAnalysis: BdOutreachAnalysis | null = storedBd ?? null;
    let whyInteresting: ProspectWhyInteresting | null = null;

    if (company) {
      const hiringProfile = computeHiringIntelligenceProfile(company, {
        locations: [],
        regions: [],
        sectors: [],
        employee_range: { min: null, max: null },
        desired_roles: item.scoreBreakdown.rolesSought ?? [],
        vacancy_required: false,
        minimum_hiring_score: 70,
        minimum_opportunity_score: 70,
        maximum_companies: 25,
        maximum_drafts: 10,
        contact_roles: [],
        outreach_mode: "draft_only",
        approval_mode: "manual",
        exclusions: [],
        uncertainties: [],
        reasoning: "",
      });
      const opportunity = opportunityFromItem(item);
      bdAnalysis = storedBd ?? analyzeBdOutreachContext(company, hiringProfile, opportunity);
      whyInteresting = buildWhyInteresting(bdAnalysis, item.totalScore, opportunity.opportunityScore);
    } else if (storedBd) {
      whyInteresting = buildWhyInteresting(storedBd, item.totalScore, item.scoreBreakdown.opportunity ?? 0);
    } else if ((item.scoreBreakdown.opportunityWhy?.length ?? 0) > 0) {
      whyInteresting = {
        whyInteresting: item.scoreBreakdown.opportunityWhy!.join(" "),
        whyRecruitmentHard: item.scoreBreakdown.recruitmentPotentialMotivation ?? "Recruitment vraagt waarschijnlijk extra capaciteit.",
        whyHireFlowHelps: item.scoreBreakdown.bestApproach ?? "HireFlow kan flexibel opschalen wanneer hiring piekt.",
        expectedOpportunityPercent: Math.min(95, Math.max(5, item.totalScore ?? item.scoreBreakdown.opportunity ?? 50)),
      };
    }

    const painScore = computeRecruitmentPainScore({
      company,
      vacancies,
      scoreBreakdown: item.scoreBreakdown,
      hiringScore: item.hiringScore,
    });

    let recruitmentIntelligence = null;
    let recruitmentIntelligenceGeneratedAt: string | null = null;
    let recruitmentIntelligenceIsStale = false;

    if (item.companyId) {
      const intelligenceEngine = await createRecruitmentIntelligenceEngine();
      const intelligence = await intelligenceEngine.getAnalysis(context, item.companyId, {
        generateIfMissing: true,
      });

      if (intelligence.isStale || !intelligence.analysis) {
        const refreshed = await intelligenceEngine.ensureFreshAnalysis(context, item.companyId, {
          runItemId: item.id,
          force: intelligence.isStale,
        });
        recruitmentIntelligence = refreshed?.analysis ?? intelligence.analysis;
        recruitmentIntelligenceGeneratedAt = refreshed?.generatedAt ?? intelligence.generatedAt;
        recruitmentIntelligenceIsStale = false;
      } else {
        recruitmentIntelligence = intelligence.analysis;
        recruitmentIntelligenceGeneratedAt = intelligence.record?.generatedAt ?? intelligence.generatedAt;
        recruitmentIntelligenceIsStale = intelligence.isStale;
      }
    }

    const history = item.companyId
      ? await loadOutreachHistory(this.supabase, context.organizationId, item.companyId)
      : {
          neverContacted: true,
          emailsSent: 0,
          replies: 0,
          meetingScheduled: false,
          summaryLines: ["Nog nooit benaderd"],
          lastContactAt: null,
        };

    const name = company?.name ?? item.companyName ?? candidate?.name ?? "Onbekend bedrijf";
    const website = company?.website ?? candidate?.website ?? null;
    const domain = company?.domain ?? tryExtractHost(website ?? "");

    return {
      runId,
      itemId,
      generatedAt: new Date().toISOString(),
      company: {
        companyId: item.companyId,
        name,
        logoUrl: faviconUrl(domain, website),
        website,
        linkedinUrl: company?.linkedinUrl ?? null,
        location:
          formatLocation(
            company?.city ?? item.companyCity ?? candidate?.city ?? null,
            company?.region ?? null,
            company?.country ?? null,
          ),
        sector: company?.sector ?? item.companySector ?? candidate?.sector ?? null,
        employeeLabel: company
          ? formatEmployees({
              count: company.employeeCount,
              min: company.employeeCountMin,
              max: company.employeeCountMax,
              label: company.employeeCountLabel,
            })
          : candidate?.employeeCountRange
            ? `${candidate.employeeCountRange} medewerkers`
            : null,
        revenueClass: null,
      },
      hiring,
      whyInteresting,
      painScore,
      contacts: buildContacts(pageData, item),
      history,
      notes: company?.notes ?? null,
      draft: {
        messageId: item.outreachMessageId,
        subject: storedEmailWriter?.subject ?? outreachMessage?.subject ?? item.draftSubject ?? null,
        bodyText: storedEmailWriter?.bodyText ?? outreachMessage?.bodyText ?? null,
        status: outreachMessage?.status ?? null,
        followUpSubject: followUp?.subject ?? null,
        followUpBodyText: followUp?.bodyText ?? null,
        warnings: item.warnings ?? [],
        emailWriter: storedEmailWriter,
      },
      bdAnalysis,
      recruitmentIntelligence,
      recruitmentIntelligenceGeneratedAt,
      recruitmentIntelligenceIsStale,
      itemStage: item.stage,
      totalScore: item.totalScore,
      warnings: item.warnings ?? [],
    };
  }
}
