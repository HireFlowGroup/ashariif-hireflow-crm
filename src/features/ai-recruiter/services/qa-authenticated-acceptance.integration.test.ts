/**
 * Live QA — authenticated slot + EXPLICIT_TEST_FIXTURE downstream (geen service role, geen discovery HTTP).
 * Vereist: QA_TEST_EMAIL, QA_TEST_PASSWORD, NEXT_PUBLIC_SUPABASE_* in .env.local
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";

import type { AiRecruiterSearchPlan } from "@/features/ai-recruiter/domain/types";
import { aiRecruiterRunSettingsSchema } from "@/features/ai-recruiter/domain/types";
import type { QualifiedDiscoveryCandidate } from "@/features/company-finder/discovery/discovery-quality.types";
import { createCompaniesServiceFromClient } from "@/features/companies/create-companies-service";
import { saveDiscoveryCompanyWithDedupe } from "@/features/company-finder/services/discovery-company-deduplication.service";
import {
  releaseAiRecruiterRunSlot,
  reserveAiRecruiterRunSlot,
} from "@/features/ai-recruiter/services/run-slot-persistence.service";
import { SupabaseAiRecruiterRepository } from "@/features/ai-recruiter/repositories/supabase-ai-recruiter.repository";
import { evaluateConceptEligibility } from "@/features/ai-recruiter/services/evaluate-concept-eligibility.service";
import { createVacancyEvidence } from "@/features/ai-recruiter/services/vacancy-evidence.service";
import { mapCompanyRowToDomain } from "@/features/companies/repositories/company.mapper";
import type { Company as CompanyRow } from "@/types/crm";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import { createProspectOutreachDraft } from "@/features/ai-recruiter/services/create-prospect-outreach-draft.service";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { OpportunityAssessment } from "@/features/ai-recruiter/services/opportunity-scorer.service";
import { createEmailProvider } from "@/features/outreach-engine/email/create-email-provider";
import { SupabaseOutreachEngineRepository } from "@/features/outreach-engine/repositories/supabase-outreach-engine.repository";
import { OutreachEngine } from "@/features/outreach-engine/services/outreach-engine.service";

const QA_ENABLED = Boolean(process.env.QA_TEST_EMAIL && process.env.QA_TEST_PASSWORD);

const RUN_LABEL = "QA_SLOT_SYNTHETIC";
const FIXTURE_TAG = "EXPLICIT_TEST_FIXTURE";

type QaEvidence = {
  generatedAt: string;
  organizationId?: string;
  userId?: string;
  slotRunId?: string;
  downstreamRunId?: string;
  companyId?: string;
  itemId?: string;
  commitCounters?: {
    run_id?: string;
    organization_id?: string;
    companies_committed?: number;
    drafts_committed?: number;
  } | null;
  slotTests?: Record<string, unknown>;
  downstream?: Record<string, unknown>;
  downstreamDraftId?: string;
  cleanup?: string[];
};

const evidence: QaEvidence = { generatedAt: new Date().toISOString(), cleanup: [] };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Ontbrekende env: ${name}`);
  return value;
}

function fixturePlan(maxCompanies = 1): AiRecruiterSearchPlan {
  return {
    locations: ["Rotterdam"],
    regions: [],
    sectors: ["software"],
    employee_range: { min: 20, max: 200 },
    desired_roles: ["Corporate Recruiter"],
    vacancy_required: true,
    minimum_hiring_score: 30,
    minimum_opportunity_score: 30,
    maximum_companies: maxCompanies,
    maximum_drafts: 1,
    contact_roles: ["HR Manager"],
    outreach_mode: "draft_only",
    approval_mode: "manual",
    exclusions: [],
    uncertainties: [],
    reasoning: `${FIXTURE_TAG} ${RUN_LABEL}`,
  };
}

async function fetchCommitCounters(client: SupabaseClient, runId: string) {
  const { data, error } = await client
    .from("ai_recruiter_run_commit_counters")
    .select("run_id, organization_id, companies_committed, drafts_committed, updated_at")
    .eq("run_id", runId)
    .maybeSingle();
  if (error) {
    if (/permission denied/i.test(error.message)) {
      return null;
    }
    throw new Error(error.message);
  }
  return data as {
    run_id: string;
    organization_id: string;
    companies_committed: number;
    drafts_committed: number;
    updated_at: string;
  } | null;
}

async function signInClient(): Promise<SupabaseClient> {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const anon = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const ref = url.match(/https:\/\/([^.]+)/)?.[1] ?? "";
  if (ref !== "vcmegbghsaqagikfxces") {
    throw new Error(`Verkeerd Supabase-project: ${ref}`);
  }

  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const email = requireEnv("QA_TEST_EMAIL");
  const password = requireEnv("QA_TEST_PASSWORD");
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? "QA-login mislukt");
  }

  return client;
}

async function createQaRun(
  repository: SupabaseAiRecruiterRepository,
  organizationId: string,
  userId: string,
  suffix: string,
  maxCompanies: number,
) {
  return repository.createRun(
    organizationId,
    userId,
    {
      name: `${RUN_LABEL} ${suffix} ${new Date().toISOString()}`,
      prompt: `${FIXTURE_TAG} — ${suffix}`,
      searchPlan: fixturePlan(maxCompanies),
    },
    aiRecruiterRunSettingsSchema.parse({
      outreachMode: "draft_only",
      approvalMode: "manual",
      sendEnabled: false,
    }),
  );
}

async function cleanupRun(client: SupabaseClient, runId: string) {
  await client.from("ai_recruiter_run_items").delete().eq("run_id", runId);
  await client.from("ai_recruiter_run_commit_counters").delete().eq("run_id", runId);
  await client.from("ai_recruiter_runs").delete().eq("id", runId);
  evidence.cleanup?.push(`run ${runId}`);
}

describe.runIf(QA_ENABLED)("QA authenticated acceptance (live DB)", () => {
  let client: SupabaseClient;
  let organizationId: string;
  let userId: string;
  let repository: SupabaseAiRecruiterRepository;
  let companyId: string | undefined;

  beforeAll(async () => {
    client = await signInClient();
    const user = (await client.auth.getUser()).data.user!;
    userId = user.id;
    const { data: profile, error: profileError } = await client
      .from("profiles")
      .select("organization_id")
      .eq("id", userId)
      .single();
    if (profileError || !profile?.organization_id) {
      throw new Error(profileError?.message ?? "Profiel/tenant niet gevonden");
    }
    organizationId = profile.organization_id;
    evidence.organizationId = organizationId;
    evidence.userId = userId;
    repository = new SupabaseAiRecruiterRepository(client);
  });

  afterAll(async () => {
  if (process.env.QA_PRESERVE_FOR_UI !== "1") {
    if (client && evidence.downstreamRunId) {
      await cleanupRun(client, evidence.downstreamRunId);
    }
    if (client && companyId) {
      await client.from("companies").delete().eq("id", companyId);
      evidence.cleanup?.push(`company ${companyId}`);
    }
  }
    const outPath = path.join(process.cwd(), "scripts/qa-acceptance-evidence.json");
    writeFileSync(outPath, JSON.stringify(evidence, null, 2), "utf8");
  });

  it("fase 2: slot reservation, counters, cap en tenant guard", async () => {
    const run = await createQaRun(repository, organizationId, userId, "slot-cap", 2);
    evidence.slotRunId = run.id;

    try {
      const caps = { maximumCompanies: 2, maximumDrafts: 1 };
      const ctx = { organizationId, runId: run.id, caps };

      const first = await reserveAiRecruiterRunSlot(client, "company", ctx, { requireDatabaseGuarantees: true });
      const second = await reserveAiRecruiterRunSlot(client, "company", ctx, { requireDatabaseGuarantees: true });
      const third = await reserveAiRecruiterRunSlot(client, "company", ctx, { requireDatabaseGuarantees: true });

      expect(first.reserved).toBe(true);
      expect(second.reserved).toBe(true);
      expect(third.reserved).toBe(false);

      const row = await fetchCommitCounters(client, run.id);
      expect(row).not.toBeNull();
      expect(row?.companies_committed).toBe(2);
      expect(row?.organization_id).toBe(organizationId);

      const { data: visibleCounters } = await client
        .from("ai_recruiter_run_commit_counters")
        .select("run_id, organization_id, companies_committed");
      expect((visibleCounters ?? []).every((c) => c.organization_id === organizationId)).toBe(true);

      const { error: tenantError } = await client.rpc("reserve_ai_recruiter_run_slot", {
        p_run_id: run.id,
        p_organization_id: "00000000-0000-0000-0000-000000000099",
        p_slot: "company",
        p_max: 5,
      });
      expect(tenantError).toBeTruthy();

      evidence.slotTests = {
        firstReserved: first.reserved,
        secondReserved: second.reserved,
        thirdReserved: third.reserved,
        companiesCommitted: row?.companies_committed,
        tenantGuardRejected: Boolean(tenantError),
      };
      evidence.commitCounters = row;

      const idempotentRepeat = await reserveAiRecruiterRunSlot(client, "company", ctx, {
        requireDatabaseGuarantees: true,
      });
      expect(idempotentRepeat.reserved).toBe(false);
      if (row) {
        const rowAfter = await fetchCommitCounters(client, run.id);
        expect(rowAfter?.companies_committed).toBe(2);
      }

      await releaseAiRecruiterRunSlot(
        client,
        "company",
        { organizationId, runId: run.id },
        { requireDatabaseGuarantees: true },
      );
      if (row) {
        const rowReleased = await fetchCommitCounters(client, run.id);
        expect(rowReleased?.companies_committed).toBe(1);
      }

      await releaseAiRecruiterRunSlot(
        client,
        "company",
        { organizationId, runId: run.id },
        { requireDatabaseGuarantees: true },
      );
      if (row) {
        const rowReleased2 = await fetchCommitCounters(client, run.id);
        expect(rowReleased2?.companies_committed).toBe(0);
      } else {
        const afterReleases = await reserveAiRecruiterRunSlot(client, "company", ctx, {
          requireDatabaseGuarantees: true,
        });
        expect(afterReleases.reserved).toBe(true);
        await releaseAiRecruiterRunSlot(client, "company", ctx, { requireDatabaseGuarantees: true });
      }
    } finally {
      await cleanupRun(client, run.id);
    }
  });

  it("fase 3: EXPLICIT_TEST_FIXTURE via saveDiscoveryCompanyWithDedupe + eligibility + run item", async () => {
    const domain = `qa-accept-${randomUUID().slice(0, 8)}.fixture.test`;
    const run = await createQaRun(repository, organizationId, userId, "downstream", 1);
    evidence.downstreamRunId = run.id;

    try {
      const countersBefore = await fetchCommitCounters(client, run.id);
      if (countersBefore) {
        expect(countersBefore.companies_committed).toBe(0);
      }

      const companiesService = createCompaniesServiceFromClient(client);
      const qualified: QualifiedDiscoveryCandidate = {
        candidate: {
          name: `QA TechWorks (${FIXTURE_TAG})`,
          website: `https://${domain}`,
          domain,
          city: "Rotterdam",
          sector: "software",
          source: "fixture",
          sourceUrl: `https://${domain}/vacatures`,
          confidence: 0.9,
          vacancyCount: 1,
          vacancyTitles: ["Corporate Recruiter"],
        } as QualifiedDiscoveryCandidate["candidate"],
        companyType: "company_website",
        companyConfidence: 85,
        discoveryReason: `${FIXTURE_TAG} QA downstream`,
        discoveryProvider: "fixture",
        urlCategory: "company",
        homepageSignalCount: 2,
        saveStatus: "company",
      };

      const save = await saveDiscoveryCompanyWithDedupe({
        companiesService,
        context: { organizationId, userId },
        qualified,
        existingCompanies: [],
        runPersistence: {
          organizationId,
          runId: run.id,
          maximumCompanies: 1,
          client,
        },
      });

      if (save.type !== "saved") {
        throw new Error(`Verwacht save.type=saved, kreeg ${save.type}`);
      }
      companyId = save.companyId;
      evidence.companyId = companyId;

      const countersAfter = await fetchCommitCounters(client, run.id);
      expect(countersAfter).not.toBeNull();
      expect(countersAfter?.companies_committed).toBe(1);

      const capCtx = {
        organizationId,
        runId: run.id,
        caps: { maximumCompanies: 1, maximumDrafts: 1 },
      };
      await expect(
        saveDiscoveryCompanyWithDedupe({
          companiesService,
          context: { organizationId, userId },
          qualified: {
            ...qualified,
            candidate: {
              ...qualified.candidate,
              name: `QA Other (${FIXTURE_TAG})`,
              website: `https://other-${domain}`,
              domain: `other-${domain}`,
            } as QualifiedDiscoveryCandidate["candidate"],
          },
          existingCompanies: [],
          runPersistence: {
            organizationId,
            runId: run.id,
            maximumCompanies: 1,
            client,
          },
        }),
      ).rejects.toThrow(/Database-slot niet gereserveerd/);

      if (!companyId) throw new Error("companyId ontbreekt na save");
      const { data: companyRow } = await client.from("companies").select("*").eq("id", companyId).single();
      const company = {
        ...mapCompanyRowToDomain(companyRow as CompanyRow, userId),
        city: "Rotterdam",
        sector: "software",
        employeeCount: 80,
        employeeCountMin: 50,
        employeeCountMax: 120,
        vacancyCount: 1,
      };
      expect(company.domain).toBe(domain);

      const plan = fixturePlan(1);
      const vacancy = createVacancyEvidence({
        companyName: company.name,
        companyDomain: domain,
        jobTitle: "Corporate Recruiter",
        jobUrl: `https://${domain}/vacatures/corporate-recruiter`,
        sourceUrl: `https://${domain}/vacatures/corporate-recruiter`,
        sourceType: "discovery_classification",
        desiredRoleMatch: true,
        validationReason: FIXTURE_TAG,
        hiringSignalStrength: 80,
      });

      const contact: SelectedDiscoveredContact = {
        contactId: null,
        email: `recruitment@${domain}`,
        recipientName: "Recruitment",
        jobTitle: "Corporate Recruiter",
        linkedinUrl: null,
        sourceType: "company_website",
        verificationStatus: "verified",
        relevanceScore: 85,
        confidence: 0.9,
        isGeneralMailbox: false,
        roleLabel: "Recruiter",
        selectionReason: FIXTURE_TAG,
        reliability: { level: "high", score: 85, summary: FIXTURE_TAG, factors: ["fixture"] },
      };

      const eligibility = evaluateConceptEligibility({
        company,
        plan,
        hiringScore: 85,
        opportunityScore: 82,
        vacancyCount: 1,
        vacancies: [vacancy],
        contact,
        contactStage: "contact_found",
        desiredRoleMatch: true,
      });
      expect(eligibility.eligible, eligibility.reasonCode).toBe(true);

      const item = await repository.createRunItem(organizationId, run.id, {
        companyId,
        stage: "contact_found",
        status: "pending",
        discoveryScore: 85,
        externalCompanyData: {
          contactDiscovery: { selected: contact, stage: "contact_found" },
          vacancyEvidence: [vacancy],
          vacancies: [vacancy],
          eligibility,
        },
      });
      evidence.itemId = item.id;

      const engineContext = { organizationId, userId };
      const outreachEngine = new OutreachEngine(
        new SupabaseOutreachEngineRepository(client),
        createCompaniesServiceFromClient(client),
        createEmailProvider(),
        client,
      );
      const hiring = computeHiringIntelligenceProfile(company, plan);
      const opportunity: OpportunityAssessment = {
        opportunityScore: 82,
        agencyNeedLikelihood: "high",
        recruitmentPotential: "HIGH",
        recruitmentPotentialMotivation: FIXTURE_TAG,
        why: ["fixture vacancy"],
        rolesSought: plan.desired_roles,
        urgency: "medium",
        bestApproach: "direct",
        breakdown: {
          growth: 10,
          multipleVacancies: 10,
          noInternalRecruiter: 10,
          staleVacancies: 0,
          scalability: 5,
        },
      };

      const draft = await createProspectOutreachDraft(engineContext, outreachEngine, {
        runId: run.id,
        companyId,
        company,
        selected: contact,
        hiring,
        opportunity,
        vacancies: [vacancy],
      });
      expect(draft.outreachMessageId).toBeTruthy();

      const linked = await repository.updateRunItem(organizationId, item.id, {
        outreachMessageId: draft.outreachMessageId,
        stage: "draft_created",
      });
      expect(linked.outreachMessageId).toBe(draft.outreachMessageId);

      const stored = await outreachEngine.getMessage(engineContext, draft.outreachMessageId);
      expect(stored?.bodyText?.length ?? 0).toBeGreaterThan(20);
      expect(stored?.status).not.toBe("sent");

      await expect(
        createProspectOutreachDraft(engineContext, outreachEngine, {
          runId: run.id,
          companyId,
          company,
          selected: contact,
          hiring,
          opportunity,
          vacancies: [vacancy],
        }),
      ).rejects.toThrow(/duplicate|idempotency/i);
      evidence.downstreamDraftId = draft.outreachMessageId;

      const ownedRun = await repository.getRun(organizationId, run.id);
      expect(ownedRun?.createdBy).toBe(userId);

      evidence.downstream = {
        saveType: save.type,
        companiesCommitted: countersAfter?.companies_committed,
        eligibilityEligible: eligibility.eligible,
        itemId: item.id,
        companyDomain: domain,
        uiPath: `/ai-recruiter/runs/${run.id}`,
      };
      evidence.commitCounters = countersAfter;
    } finally {
      if (process.env.QA_PRESERVE_FOR_UI !== "1") {
        await cleanupRun(client, run.id);
      }
    }
  });
});