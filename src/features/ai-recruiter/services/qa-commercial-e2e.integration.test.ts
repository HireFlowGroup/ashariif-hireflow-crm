/**
 * Commerciële E2E (GO) — Laurens targeted, echte discovery binnen preflight-budget.
 * COMMERCIAL_E2E=1 + QA credentials vereist.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";

import type { AiRecruiterSearchPlan, AiRecruiterStreamEvent } from "@/features/ai-recruiter/domain/types";
import { aiRecruiterRunSettingsSchema } from "@/features/ai-recruiter/domain/types";
import { clampAiRecruiterSearchPlan } from "@/features/ai-recruiter/services/search-plan-limits.service";
import { SupabaseAiRecruiterRepository } from "@/features/ai-recruiter/repositories/supabase-ai-recruiter.repository";
import { ProspectAuditRepository } from "@/features/ai-recruiter/repositories/prospect-audit.repository";
import { AiRecruiterOrchestrator } from "@/features/ai-recruiter/services/ai-recruiter-orchestrator.service";
import { createCompaniesServiceWithWriteClient } from "@/features/companies/create-companies-service";
import { createContactsServiceFromClient } from "@/features/contacts/create-contacts-service";
import { createContactDiscoveryEngine } from "@/features/contact-finder/create-contact-discovery-engine";
import { CompanyFinderService } from "@/features/company-finder/services/company-finder.service";
import { SupabaseCompanySearchJobRepository } from "@/features/company-finder/repositories";
import { createEmailProvider } from "@/features/outreach-engine/email/create-email-provider";
import { SupabaseOutreachEngineRepository } from "@/features/outreach-engine/repositories/supabase-outreach-engine.repository";
import { OutreachEngine } from "@/features/outreach-engine/services/outreach-engine.service";
import { clearProviderQuotaRegistryForTests } from "@/features/company-finder/discovery/provider-quota-registry.service";

const RUN_NAME = "Commercial E2E Laurens — GO Validation";
const LAURENS_PROMPT =
  "Commerciële validatie E2E — exact 1 werkgever: Laurens (officieel domein werkenbij.laurens.nl) in Nederland. Targeted discovery. Zoek Corporate Recruiter vacature op werkenbij.laurens.nl. Geen andere werkgevers accepteren. Maximum 1 concept. maximum_companies=1.";

const ENABLED = Boolean(
  process.env.COMMERCIAL_E2E === "1"
  && process.env.QA_TEST_EMAIL
  && process.env.QA_TEST_PASSWORD,
);

const report: Record<string, unknown> = {
  startedAt: new Date().toISOString(),
  prompt: LAURENS_PROMPT,
  limits: {
    maxEmployers: 3,
    maxHttp: 10,
    maxDrafts: 1,
    maxPaidAi: 1,
  },
};

function buildLaurensPlan(): AiRecruiterSearchPlan {
  return clampAiRecruiterSearchPlan({
    locations: ["Nederland"],
    regions: [],
    sectors: ["zorg"],
    employee_range: { min: 20, max: 500 },
    desired_roles: ["Corporate Recruiter"],
    vacancy_required: true,
    minimum_hiring_score: 70,
    minimum_opportunity_score: 70,
    maximum_companies: 1,
    maximum_drafts: 1,
    contact_roles: ["HR Manager", "Recruitment Manager", "Corporate Recruiter"],
    outreach_mode: "draft_only",
    approval_mode: "manual",
    exclusions: [],
    uncertainties: [],
    reasoning: LAURENS_PROMPT,
  });
}

async function signIn(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const ref = url.match(/https:\/\/([^.]+)/)?.[1];
  if (ref !== "vcmegbghsaqagikfxces") throw new Error(`Verkeerd project: ${ref}`);
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({
    email: process.env.QA_TEST_EMAIL!,
    password: process.env.QA_TEST_PASSWORD!,
  });
  if (error || !data.user) throw new Error(error?.message ?? "login failed");
  return client;
}

async function createOrchestrator(client: SupabaseClient): Promise<AiRecruiterOrchestrator> {
  const repository = new SupabaseAiRecruiterRepository(client);
  const companiesService = await createCompaniesServiceWithWriteClient(client);
  const contactsService = createContactsServiceFromClient(client);
  const contactDiscovery = await createContactDiscoveryEngine(client, contactsService, companiesService);
  const outreachEngine = new OutreachEngine(
    new SupabaseOutreachEngineRepository(client),
    companiesService,
    createEmailProvider(),
    client,
  );
  const companyFinder = new CompanyFinderService(
    new SupabaseCompanySearchJobRepository(client),
    companiesService,
    client,
  );
  const prospectAudit = new ProspectAuditRepository(client);
  return new AiRecruiterOrchestrator(
    repository,
    companyFinder,
    contactDiscovery,
    companiesService,
    outreachEngine,
    client,
    prospectAudit,
  );
}

describe.runIf(ENABLED)("Commercial E2E Laurens (GO)", () => {
  let client: SupabaseClient;
  let organizationId: string;
  let userId: string;
  let runId: string;

  beforeAll(() => {
    clearProviderQuotaRegistryForTests();
    process.env.AI_RECRUITER_DEFAULT_MAX_COMPANIES = "1";
    process.env.AI_RECRUITER_PLAN_LIMIT_MAXIMUM_COMPANIES = "3";
    process.env.AI_RECRUITER_DEFAULT_MAX_DRAFTS = "1";
    process.env.AI_RECRUITER_PLAN_LIMIT_MAXIMUM_DRAFTS = "1";
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_ATTEMPTS_PER_RUN = "10";
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_SERPAPI = "8";
    /** Tavily plan-quota vaak uit bij QA — SerpAPI binnen hetzelfde HTTP-budget. */
    process.env.AI_RECRUITER_DISCOVERY_MAX_HTTP_TAVILY = "0";
    process.env.AI_RECRUITER_DISCOVERY_MAX_PROVIDER_ATTEMPTS = "4";
    process.env.AI_RECRUITER_DISCOVERY_QUERY_COUNT = "1";
    process.env.AI_RECRUITER_MIN_DISCOVERY_QUERIES = "1";
    process.env.AI_RECRUITER_DISCOVERY_SUPPLEMENTAL_QUERY_CAP = "0";
    process.env.AI_RECRUITER_SEND_ENABLED = "false";
  });

  afterAll(() => {
    report.finishedAt = new Date().toISOString();
    writeFileSync(
      path.join(process.cwd(), "scripts/qa-commercial-e2e-report.json"),
      JSON.stringify(report, null, 2),
      "utf8",
    );
  });

  it(
    "volledige workflow binnen budget",
    async () => {
      client = await signIn();
      const user = (await client.auth.getUser()).data.user!;
      userId = user.id;
      const { data: profile } = await client
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .single();
      organizationId = profile!.organization_id as string;
      report.organizationId = organizationId;

      const repository = new SupabaseAiRecruiterRepository(client);
      const plan = buildLaurensPlan();
      const settings = aiRecruiterRunSettingsSchema.parse({
        outreachMode: "draft_only",
        approvalMode: "manual",
        sendEnabled: false,
      });
      const run = await repository.createRun(
        organizationId,
        userId,
        { name: RUN_NAME, prompt: LAURENS_PROMPT, searchPlan: plan },
        settings,
      );
      runId = run.id;
      report.runId = runId;

      const orchestrator = await createOrchestrator(client);
      const events: AiRecruiterStreamEvent[] = [];
      let terminalError: string | null = null;

      for await (const event of orchestrator.runSession({ organizationId, userId }, runId)) {
        events.push(event);
        if (event.type === "error") terminalError = event.message;
      }

      const finalRun = await repository.getRun(organizationId, runId);
      const items = await repository.listRunItems(organizationId, runId);
      report.runStatus = finalRun?.status;
      report.counters = finalRun?.counters;
      report.terminalError = terminalError;
      report.eventTypes = [...new Set(events.map((e) => e.type))];

      const { data: counters } = await client
        .from("ai_recruiter_run_commit_counters")
        .select("*")
        .eq("run_id", runId)
        .maybeSingle();
      report.commitCounters = counters;

      const companyRows = [];
      for (const item of items) {
        if (!item.companyId) continue;
        const { data: co } = await client
          .from("companies")
          .select("id,name,domain,canonical_domain,vacancy_page_url,hiring_signals,vacancy_count")
          .eq("id", item.companyId)
          .single();
        companyRows.push({ item, company: co });
        if (item.outreachMessageId) {
          const { data: msg } = await client
            .from("outreach_messages")
            .select("id,status,subject,left(body_text,120)")
            .eq("id", item.outreachMessageId)
            .single();
          report.outreachMessage = msg;
        }
      }
      report.prospects = companyRows.map((r) => ({
        companyName: r.company?.name,
        domain: r.company?.domain ?? r.company?.canonical_domain,
        vacancyPageUrl: (r.company as { vacancy_page_url?: string } | null)?.vacancy_page_url ?? null,
        stage: r.item.stage,
        status: r.item.status,
        eligibility: (r.item as { externalCompanyData?: { eligibility?: unknown } }).externalCompanyData?.eligibility,
        outreachMessageId: r.item.outreachMessageId,
      }));

      const laurensHit = companyRows.some((r) =>
        /laurens/i.test(r.company?.name ?? "")
        || /laurens/i.test(r.company?.domain ?? "")
        || /werkenbij\.laurens\.nl/i.test(r.company?.domain ?? ""),
      );
      const enecoHit = companyRows.some((r) => /eneco/i.test(r.company?.name ?? ""));
      report.employerLaurens = laurensHit;
      report.employerEnecoRejected = !enecoHit;

      const diagnostics = finalRun?.settings?.runDiagnostics as { discovery?: { providerRequests?: unknown } } | undefined;
      report.discoveryDiagnostics = diagnostics?.discovery ?? null;

      const runDiagnostics = finalRun?.settings?.runDiagnostics as {
        errorCode?: string | null;
        responseCount?: number;
      } | undefined;
      report.runDiagnostics = runDiagnostics ?? null;

      expect(enecoHit).toBe(false);
      expect(terminalError).toBeNull();
      expect(finalRun?.status).not.toBe("failed");

      const laurensRow = companyRows.find((r) =>
        /laurens/i.test(r.company?.name ?? "")
        || /werkenbij\.laurens\.nl/i.test(r.company?.domain ?? ""),
      );

      if (laurensHit) {
        expect(counters).not.toBeNull();
        expect(
          (counters as { companies_committed?: number; companies_persisted?: number } | null)
            ?.companies_committed
          ?? (counters as { companies_persisted?: number } | null)?.companies_persisted
          ?? 0,
        ).toBeGreaterThanOrEqual(1);

        const vacancyUrl = (laurensRow?.company as { vacancy_page_url?: string } | null)?.vacancy_page_url ?? "";
        expect(vacancyUrl).toMatch(/werkenbij\.laurens\.nl\/vacature\//i);

        const itemEligibility = (laurensRow?.item.externalCompanyData as { eligibility?: { reasonCode?: string } })
          ?.eligibility;
        expect(itemEligibility?.reasonCode).not.toBe("no_matching_role");

        const draftCount = (counters as { drafts_committed?: number } | null)?.drafts_committed ?? 0;
        const hasDraft = items.some((i) => i.outreachMessageId);
        if (finalRun?.status === "completed" || finalRun?.status === "partially_completed") {
          expect(hasDraft || draftCount >= 1 || finalRun.counters.draftsCreated >= 1).toBe(true);
        }
      } else {
        const acceptableWithoutEmployer =
          finalRun?.status === "completed"
          && items.length === 0
          && (diagnostics as { outcome?: string } | null)?.outcome === "needs_evidence";
        expect(laurensHit || acceptableWithoutEmployer).toBe(true);
      }

      expect(finalRun?.status === "failed").toBe(false);
    },
    300_000,
  );
});