import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import { createProspectOutreachDraft } from "@/features/ai-recruiter/services/create-prospect-outreach-draft.service";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import {
  generateRecruitmentOutreachVariant,
  type DraftVariantType,
} from "@/features/ai-recruiter/services/recruitment-outreach-writer.service";
import type { VacancyEvidence } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { toCompanyId } from "@/features/companies/domain";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

const itemIdSchema = z.string().uuid("Ongeldige itemId");
const bodySchema = z.object({
  variant: z.enum(["default", "shorter", "personal", "formal", "direct"]).default("default"),
});

function opportunityFromItem(scoreBreakdown: {
  opportunity?: number;
  opportunityWhy?: string[];
  rolesSought?: string[];
  urgency?: "high" | "medium" | "low";
  bestApproach?: string;
  recruitmentPotential?: "LOW" | "MEDIUM" | "HIGH";
  recruitmentPotentialMotivation?: string;
}): OpportunityAssessment {
  return {
    opportunityScore: scoreBreakdown.opportunity ?? 0,
    agencyNeedLikelihood:
      (scoreBreakdown.opportunity ?? 0) >= 75 ? "high" : (scoreBreakdown.opportunity ?? 0) >= 50 ? "medium" : "low",
    recruitmentPotential: scoreBreakdown.recruitmentPotential ?? "MEDIUM",
    recruitmentPotentialMotivation: scoreBreakdown.recruitmentPotentialMotivation ?? "",
    why: scoreBreakdown.opportunityWhy ?? [],
    rolesSought: scoreBreakdown.rolesSought ?? [],
    urgency: scoreBreakdown.urgency ?? "medium",
    bestApproach: scoreBreakdown.bestApproach ?? "",
    breakdown: {
      growth: 0,
      multipleVacancies: 0,
      noInternalRecruiter: 0,
      staleVacancies: 0,
      scalability: 0,
    },
  };
}

export async function POST(request: Request, routeContext: RouteContext): Promise<NextResponse> {
  const context = await getAuthenticatedServiceContext();
  if (!context) return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });

  const { runId: rawRunId, itemId: rawItemId } = await routeContext.params;
  const runIdResult = aiRecruiterRunIdParamSchema.safeParse(rawRunId);
  const itemIdResult = itemIdSchema.safeParse(rawItemId);

  if (!runIdResult.success || !itemIdResult.success) {
    return NextResponse.json({ error: "Ongeldige parameters" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige body" }, { status: 400 });
  }

  try {
    const repository = await createAiRecruiterRepository();
    const item = await repository.getRunItem(context.organizationId, itemIdResult.data);

    if (!item || item.runId !== runIdResult.data) {
      return NextResponse.json({ error: "Prospect niet gevonden" }, { status: 404 });
    }

    if (!item.companyId) {
      return NextResponse.json({ error: "Geen bedrijf gekoppeld." }, { status: 422 });
    }

    const client = await createClient();
    const companiesService = await createCompaniesServiceWithWriteClient(client);
    const company = await companiesService.getCompany(context, toCompanyId(item.companyId));
    const run = await repository.getRun(context.organizationId, runIdResult.data);
    const plan = run?.searchCriteria;

    if (!plan) {
      return NextResponse.json({ error: "Run niet gevonden" }, { status: 404 });
    }

    const hiring = computeHiringIntelligenceProfile(company, plan);
    const opportunity = opportunityFromItem(item.scoreBreakdown);

    const external = item.externalCompanyData as {
      contactDiscovery?: { selected?: SelectedDiscoveredContact | null };
      vacancyEvidence?: VacancyEvidence[];
    } | null;

    const contact = external?.contactDiscovery?.selected;
    if (!contact?.email) {
      return NextResponse.json({ error: "Geen contact beschikbaar" }, { status: 422 });
    }

    const vacancies = external?.vacancyEvidence ?? [];
    const engine = await createOutreachEngineService();

    if (!item.outreachMessageId) {
      const created = await createProspectOutreachDraft(context, engine, {
        runId: runIdResult.data,
        companyId: item.companyId,
        company,
        selected: contact,
        hiring,
        opportunity,
        vacancies,
      });

      const updatedItem = await repository.updateRunItem(context.organizationId, item.id, {
        outreachMessageId: created.outreachMessageId,
        stage: "draft_created",
      });

      return NextResponse.json({ item: updatedItem });
    }

    const message = await engine.getMessage(context, item.outreachMessageId);
    if (!message) {
      return NextResponse.json({ error: "Conceptmail niet gevonden." }, { status: 404 });
    }

    const variant = parsed.data.variant as DraftVariantType;
    const draft = await generateRecruitmentOutreachVariant(
      {
        company,
        hiringSignals: hiring,
        companyAnalysis: opportunity,
        selectedContact: {
          email: contact.email,
          recipientName: contact.recipientName,
          isGeneralMailbox: contact.isGeneralMailbox,
          jobTitle: contact.jobTitle,
          reliability: contact.reliability,
        },
        opportunityScore: opportunity.opportunityScore,
        vacancies,
      },
      variant,
    );

    const updated = await engine.updateDraft(context, item.outreachMessageId, {
      subject: draft.recommendedSubject,
      bodyText: draft.bodyText,
    });

    return NextResponse.json({ item, message: updated, draft });
  } catch (error) {
    if (error instanceof OutreachEngineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    const message = error instanceof Error ? error.message : "Regenereren mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
