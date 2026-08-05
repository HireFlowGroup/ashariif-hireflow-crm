import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import type { DraftRewriteStyle } from "@/features/ai-recruiter/domain/prospect-dossier.types";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { toCompanyId } from "@/features/companies/domain";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { rewriteRecruiterDraft } from "@/features/ai-recruiter/services/draft-generator.service";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

const itemIdSchema = z.string().uuid("Ongeldige itemId");
const bodySchema = z.object({
  style: z.enum(["rewrite", "shorter", "personal", "formal", "new_version"]),
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

  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ongeldige body" }, { status: 400 });
  }

  try {
    const repository = await createAiRecruiterRepository();
    const item = await repository.getRunItem(context.organizationId, itemIdResult.data);

    if (!item || item.runId !== runIdResult.data) {
      return NextResponse.json({ error: "Prospect niet gevonden" }, { status: 404 });
    }

    if (!item.outreachMessageId) {
      return NextResponse.json({ error: "Geen conceptmail om te herschrijven." }, { status: 422 });
    }

    if (!item.companyId) {
      return NextResponse.json({ error: "Geen bedrijf gekoppeld." }, { status: 422 });
    }

    const engine = await createOutreachEngineService();
    const message = await engine.getMessage(context, item.outreachMessageId);
    if (!message) {
      return NextResponse.json({ error: "Conceptmail niet gevonden." }, { status: 404 });
    }

    const client = await createClient();
    const companiesService = await createCompaniesServiceWithWriteClient(client);
    const company = await companiesService.getCompany(context, toCompanyId(item.companyId));

    const run = await repository.getRun(context.organizationId, runIdResult.data);
    const plan = run?.searchCriteria ?? {
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
      outreach_mode: "draft_only" as const,
      approval_mode: "manual" as const,
      exclusions: [],
      uncertainties: [],
      reasoning: "",
    };

    const hiring = computeHiringIntelligenceProfile(company, plan);
    const opportunity = opportunityFromItem(item.scoreBreakdown);

    const rewritten = await rewriteRecruiterDraft(
      company,
      {
        recipientName: item.contactName ?? message.recipientName,
        email: message.recipientEmail,
        isGeneralMailbox: item.stage === "general_mailbox_found",
      },
      hiring,
      opportunity,
      { subject: message.subject, bodyText: message.bodyText },
      parsed.data.style as DraftRewriteStyle,
    );

    const updated = await engine.updateDraft(context, item.outreachMessageId, rewritten);

    return NextResponse.json({
      message: updated,
      subject: updated.subject,
      bodyText: updated.bodyText,
    });
  } catch (error) {
    if (error instanceof OutreachEngineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    console.error("[AI Recruiter] POST draft rewrite failed", { error });
    const message = error instanceof Error ? error.message : "Herschrijven mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
