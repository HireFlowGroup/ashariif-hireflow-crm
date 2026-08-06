import "server-only";

import type { Company } from "@/features/companies/domain";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import type { AiRecruiterEngineContext } from "@/features/ai-recruiter/domain/types";
import { generateRecruiterFollowUpDraft } from "@/features/ai-recruiter/services/draft-generator.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { generateRecruitmentOutreachDraft } from "@/features/ai-recruiter/services/recruitment-outreach-writer.service";
import type { OutreachEngine } from "@/features/outreach-engine/services/outreach-engine.service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";

export type CreateProspectOutreachDraftResult = {
  outreachMessageId: string;
  draftWarnings: string[];
  followUpDraft: {
    subject: string;
    bodyText: string;
    confidence: number;
  };
  personalizationData: Record<string, unknown>;
};

export async function createProspectOutreachDraft(
  context: AiRecruiterEngineContext,
  outreachEngine: OutreachEngine,
  input: {
    runId: string;
    companyId: string;
    company: Company;
    selected: SelectedDiscoveredContact;
    hiring: HiringIntelligenceProfile;
    opportunity: OpportunityAssessment;
    vacancies: VacancyEvidence[];
    vacancyId?: string | null;
  },
): Promise<CreateProspectOutreachDraftResult> {
  const draft = await generateRecruitmentOutreachDraft({
    company: input.company,
    vacancy: input.vacancies[0]
      ? { id: input.vacancyId ?? "unknown", title: input.vacancies[0].title }
      : null,
    hiringSignals: input.hiring,
    companyAnalysis: input.opportunity,
    selectedContact: {
      email: input.selected.email,
      recipientName: input.selected.recipientName,
      isGeneralMailbox: input.selected.isGeneralMailbox,
      jobTitle: input.selected.jobTitle,
      reliability: input.selected.reliability,
    },
    opportunityScore: input.opportunity.opportunityScore,
    vacancies: input.vacancies,
  });

  const followUp = await generateRecruiterFollowUpDraft(
    input.company,
    {
      recipientName: input.selected.recipientName,
      email: input.selected.email,
      isGeneralMailbox: input.selected.isGeneralMailbox,
    },
    input.hiring,
    {
      subject: draft.recommendedSubject,
      bodyText: draft.bodyText,
    },
  );

  const personalizationData = {
    companyName: input.company.name,
    sector: input.company.sector,
    city: input.company.city,
    contactName: input.selected.recipientName,
    vacancyCount: input.hiring.vacancyCount,
    hiringSignal: input.hiring.signals[0]?.description ?? null,
    fieldsUsed: draft.personalizationFacts.map((f) => f.claim),
    warnings: draft.warnings,
    generatedAt: new Date().toISOString(),
    personalizationFacts: draft.personalizationFacts,
    sourceEvidence: draft.sourceEvidence,
    promptVersion: draft.promptVersion,
    model: draft.model,
    intent: "permission_to_source_candidates",
    cta: draft.cta,
    salutation: draft.salutation,
    runId: input.runId,
    vacancyId: input.vacancyId ?? null,
  };

  try {
    const message = await outreachEngine.createRecruiterDraft(context, {
      companyId: input.companyId,
      contactId: input.selected.contactId,
      recipientName: input.selected.recipientName,
      recipientEmail: input.selected.email,
      subject: draft.recommendedSubject,
      bodyText: draft.bodyText,
      runId: input.runId,
      vacancyId: input.vacancyId ?? null,
      personalizationData,
    });

    return {
      outreachMessageId: message.id,
      draftWarnings: [...draft.warnings, ...followUp.warnings],
      followUpDraft: {
        subject: followUp.subject,
        bodyText: followUp.bodyText,
        confidence: followUp.confidence,
      },
      personalizationData,
    };
  } catch (error) {
    if (error instanceof OutreachEngineError && error.code === "duplicate") {
      throw error;
    }
    throw error;
  }
}
