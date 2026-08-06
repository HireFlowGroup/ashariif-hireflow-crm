import "server-only";

import { toCompanyId } from "@/features/companies/domain";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import type { AiRecruiterEngineContext } from "@/features/ai-recruiter/domain/types";
import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { ProspectAuditRepository } from "@/features/ai-recruiter/repositories/prospect-audit.repository";
import { createProspectOutreachDraft } from "@/features/ai-recruiter/services/create-prospect-outreach-draft.service";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { evaluateProspectPipeline } from "@/features/ai-recruiter/services/prospect-eligibility-pipeline.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import { createClient } from "@/lib/supabase/server";

function opportunityFromBreakdown(breakdown: {
  opportunity?: number;
  opportunityWhy?: string[];
  rolesSought?: string[];
  urgency?: "high" | "medium" | "low";
  bestApproach?: string;
  recruitmentPotential?: "LOW" | "MEDIUM" | "HIGH";
  recruitmentPotentialMotivation?: string;
}): OpportunityAssessment {
  return {
    opportunityScore: breakdown.opportunity ?? 0,
    agencyNeedLikelihood:
      (breakdown.opportunity ?? 0) >= 75 ? "high" : (breakdown.opportunity ?? 0) >= 50 ? "medium" : "low",
    recruitmentPotential: breakdown.recruitmentPotential ?? "MEDIUM",
    recruitmentPotentialMotivation: breakdown.recruitmentPotentialMotivation ?? "",
    why: breakdown.opportunityWhy ?? [],
    rolesSought: breakdown.rolesSought ?? [],
    urgency: breakdown.urgency ?? "medium",
    bestApproach: breakdown.bestApproach ?? "",
    breakdown: {
      growth: 0,
      multipleVacancies: 0,
      noInternalRecruiter: 0,
      staleVacancies: 0,
      scalability: 0,
    },
  };
}

export async function applyManualEligibilityOverride(
  context: AiRecruiterEngineContext,
  runId: string,
  itemId: string,
) {
  const authClient = await createClient();
  const repository = await createAiRecruiterRepository();
  const companiesService = await createCompaniesServiceWithWriteClient(authClient);
  const outreachEngine = await createOutreachEngineService();
  const prospectAudit = new ProspectAuditRepository(authClient);

  const item = await repository.getRunItem(context.organizationId, itemId);
  if (!item || item.runId !== runId) {
    throw new Error("Prospect niet gevonden");
  }

  if (!item.companyId) {
    throw new Error("Prospect heeft geen gekoppeld bedrijf");
  }

  const run = await repository.getRun(context.organizationId, runId);
  if (!run) {
    throw new Error("Run niet gevonden");
  }

  const company = await companiesService.getCompany(context, toCompanyId(item.companyId));
  const hiring = computeHiringIntelligenceProfile(company, run.searchCriteria);
  const opportunity = opportunityFromBreakdown(item.scoreBreakdown);

  const external = item.externalCompanyData as {
    contactDiscovery?: {
      selected?: SelectedDiscoveredContact | null;
      stage?: string;
    };
  } | null;

  const contact = external?.contactDiscovery?.selected ?? null;
  if (!contact?.email) {
    throw new Error("Geen contact beschikbaar — pas eerst contact aan");
  }

  const pipelineDecision = evaluateProspectPipeline({
    company,
    plan: run.searchCriteria,
    hiring,
    analysis: null,
    contact,
    contactStage: external?.contactDiscovery?.stage ?? item.stage,
    manualEligibilityOverride: true,
  });

  let draftCreated = false;
  let outreachMessageId = item.outreachMessageId;

  if (!outreachMessageId) {
    const { outreachMessageId: messageId } = await createProspectOutreachDraft(
      context,
      outreachEngine,
      {
        runId,
        companyId: item.companyId,
        company,
        selected: contact,
        hiring,
        opportunity,
        vacancies: pipelineDecision.vacancies,
      },
    );
    outreachMessageId = messageId;
    draftCreated = true;
  }

  const updatedItem = await repository.updateRunItem(context.organizationId, itemId, {
    stage: draftCreated || outreachMessageId ? "draft_created" : item.stage,
    status: "completed",
    totalScore: pipelineDecision.eligibility.score,
    rejectionReason: null,
    outreachMessageId,
    externalCompanyData: {
      ...(external ?? {}),
      eligibility: pipelineDecision.eligibility,
      manualEligibilityOverride: true,
      manualOverrideAt: new Date().toISOString(),
      manualOverrideBy: context.userId,
    },
  });

  await prospectAudit.upsertDecision({
    organizationId: context.organizationId,
    runId,
    runItemId: itemId,
    company,
    eligibility: pipelineDecision.eligibility,
    vacancies: pipelineDecision.vacancies,
    contact,
    contactStage: external?.contactDiscovery?.stage ?? item.stage,
    conceptStatus: draftCreated || outreachMessageId ? "created" : "pending",
    manualEligibilityOverride: true,
  });

  return { item: updatedItem, draftCreated };
}
