import { NextResponse } from "next/server";
import { z } from "zod";

import { createAiRecruiterRepository } from "@/features/ai-recruiter/create-ai-recruiter-service";
import type { AiEmailWriterDraft } from "@/features/ai-email-writer/domain/ai-email-writer.types";
import {
  generateAiEmailDraft,
  rewriteAiEmailDraft,
} from "@/features/ai-email-writer/services/ai-email-writer.service";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { toCompanyId } from "@/features/companies/domain";
import { buildOutreachSalutation } from "@/features/contact-finder/services/contact-validation.service";
import { createRecruitmentIntelligenceEngine } from "@/features/recruitment-intelligence/create-recruitment-intelligence-engine";
import { analysisHasActionableFacts } from "@/features/recruitment-intelligence/domain/recruitment-opportunity.helpers";
import type { RecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { createOutreachEngineService } from "@/features/outreach-engine/create-outreach-engine-service";
import { OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { aiRecruiterRunIdParamSchema } from "@/lib/validations/ai-recruiter-api";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ runId: string; itemId: string }> };

const itemIdSchema = z.string().uuid("Ongeldige itemId");
const draftSchema = z.object({
  subject: z.string(),
  personalIntroduction: z.string(),
  observedSituation: z.string(),
  whyHireFlow: z.string(),
  callToAction: z.string(),
  closing: z.string(),
  bodyText: z.string(),
  wordCount: z.number(),
});

const bodySchema = z.object({
  style: z.enum(["new_version", "shorter", "formal", "personal"]).default("new_version"),
  current: draftSchema.optional(),
});

function mapAnalysisFacts(analysis: RecruitmentIntelligenceAnalysis) {
  return {
    company_summary: analysis.company_summary,
    why_agency: analysis.why_agency,
    likely_pain_points: analysis.likely_pain_points,
    why_hireflow: analysis.why_hireflow,
    hard_to_fill_roles: analysis.hard_to_fill_roles,
    urgency_rationale: analysis.urgency_rationale,
    opportunity_chance_rationale: analysis.opportunity_chance_rationale,
    likely_decision_maker: analysis.likely_decision_maker,
    opening_line: analysis.opening_line,
    recommended_cta: analysis.recommended_cta,
    recruitment_opportunity_score: analysis.recruitment_opportunity_score,
    opportunity_tier: analysis.opportunity_tier,
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

    if (!item.recipientEmail) {
      return NextResponse.json({ error: "Geen contactpersoon — voeg eerst een ontvanger toe." }, { status: 422 });
    }

    const intelligenceEngine = await createRecruitmentIntelligenceEngine();
    const intelligence = await intelligenceEngine.getAnalysis(context, item.companyId, {
      generateIfMissing: true,
    });

    if (!intelligence.analysis || !analysisHasActionableFacts(intelligence.analysis)) {
      return NextResponse.json(
        { error: "Genereer eerst Recruitment Intelligence met voldoende feiten." },
        { status: 422 },
      );
    }

    const client = await createClient();
    const companiesService = await createCompaniesServiceWithWriteClient(client);
    const company = await companiesService.getCompany(context, toCompanyId(item.companyId));

    const { SupabaseRecruitmentIntelligenceRepository } = await import(
      "@/features/recruitment-intelligence/repositories/supabase-recruitment-intelligence.repository"
    );
    const riRepo = new SupabaseRecruitmentIntelligenceRepository(client);
    const loaded = await riRepo.loadInput(context.organizationId, item.companyId, item.id);

    const salutation = buildOutreachSalutation(
      item.contactName ?? null,
      item.stage === "general_mailbox_found",
      item.recipientEmail,
    );

    const writerInput = {
      company: {
        name: company.name,
        website: company.website,
        sector: company.sector,
        city: company.city,
      },
      contact: {
        name: item.contactName ?? null,
        jobTitle: item.contactJobTitle ?? item.contactRoleLabel ?? null,
        email: item.recipientEmail,
        isGeneralMailbox: item.stage === "general_mailbox_found",
      },
      vacancies: (loaded?.vacancies ?? []).map((v) => ({
        title: v.title,
        location: v.location,
        status: v.status,
      })),
      analysisFacts: mapAnalysisFacts(intelligence.analysis),
      salutation,
    };

    let draft: AiEmailWriterDraft;

    if (parsed.data.style === "new_version" || !parsed.data.current) {
      draft = await generateAiEmailDraft(writerInput);
    } else {
      draft = await rewriteAiEmailDraft(writerInput, parsed.data.current, parsed.data.style);
    }

    if (item.outreachMessageId) {
      const outreachEngine = await createOutreachEngineService();
      await outreachEngine.updateDraft(context, item.outreachMessageId, {
        subject: draft.subject,
        bodyText: draft.bodyText,
      });
    }

    await repository.updateRunItem(context.organizationId, item.id, {
      externalCompanyData: {
        emailWriterDraft: draft,
      },
    });

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof OutreachEngineError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 422 });
    }
    console.error("[AI Email Writer] POST failed", { error });
    const message = error instanceof Error ? error.message : "E-mail genereren mislukt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
