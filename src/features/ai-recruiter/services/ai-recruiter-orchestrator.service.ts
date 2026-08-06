import "server-only";

import { toCompanyId } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
import { ProspectAuditRepository } from "@/features/ai-recruiter/repositories/prospect-audit.repository";
import {
  evaluateProspectPipeline,
  summarizeEligibilityDecisions,
} from "@/features/ai-recruiter/services/prospect-eligibility-pipeline.service";
import {
  mapScoreToDecision,
  prospectDecisionToBreakdownFields,
} from "@/features/ai-recruiter/services/prospect-decision.service";
import { classifyBusinessModel, isExcludedBusinessModel } from "@/features/company-finder/discovery/business-model-classifier.service";
import { isGenericCompanyLabel } from "@/features/company-finder/discovery/generic-company-label";
import { getAiRecruiterConfig } from "@/features/ai-recruiter/config/ai-recruiter.config";
import type {
  AiRecruiterEngineContext,
  AiRecruiterRun,
  AiRecruiterRunCounters,
  AiRecruiterRunItem,
  AiRecruiterStreamEvent,
  CreateAiRecruiterRunInput,
} from "@/features/ai-recruiter/domain/types";
import {
  aiRecruiterRunSettingsSchema,
  createInitialCounters,
  createInitialPipelineSteps,
  priorityFromTotalScore,
} from "@/features/ai-recruiter/domain/types";
import type { AiRecruiterRepository } from "@/features/ai-recruiter/repositories/ai-recruiter.repository";
import {
  dispatchConceptGeneration,
} from "@/features/ai-recruiter/services/concept-generation-dispatch.service";
import type { EligibleProspectForConcept } from "@/features/ai-recruiter/domain/concept-generation.types";
import type { VacancyEvidence, ConceptEligibilityResult } from "@/features/ai-recruiter/domain/concept-eligibility.types";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import type { HiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import {
  computeOpportunityAssessment,
  type OpportunityAssessment,
} from "@/features/ai-recruiter/services/opportunity-scorer.service";
import {
  computeSalesIntelligence,
  salesToScoreBreakdownFields,
  type SalesIntelligenceAssessment,
} from "@/features/ai-recruiter/services/sales-intelligence.service";
import { RecruiterPipelineTracker } from "@/features/ai-recruiter/services/recruiter-pipeline-tracker";
import type { RunDiagnostics } from "@/features/ai-recruiter/domain/run-diagnostics";
import {
  buildDiscoveryDiagnostics,
  buildRunFailureUiMessage,
  emptyDiscoverySummary,
  resolveProviderAvailability,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.service";
import {
  discoveryStepFailed,
  resolveRunOutcome,
} from "@/features/ai-recruiter/services/run-outcome.service";
import {
  buildRunSettingsWithDiagnostics,
  mergeDiscoveryEvent,
  skipEnrichmentAndDownstream,
} from "@/features/ai-recruiter/services/run-session.helpers";
import type { CompanySearchJob } from "@/features/company-finder/domain";
import {
  parseAiRecruiterSearchPlan,
  searchPlanToCompanyFinderCriteria,
} from "@/features/ai-recruiter/services/search-plan-parser.service";
import type { CompanyFinderService } from "@/features/company-finder/services/company-finder.service";
import type { ContactDiscoveryEngine } from "@/features/contact-finder/services/contact-discovery-engine.service";
import type { SelectedDiscoveredContact } from "@/features/contact-finder/services/contact-validation.service";
import { createRecruitmentIntelligenceEngine } from "@/features/recruitment-intelligence/create-recruitment-intelligence-engine";
import type { RecruitmentIntelligenceAnalysis } from "@/features/recruitment-intelligence/domain/recruitment-intelligence.types";
import { OutreachEngine, OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import type { SupabaseClient } from "@supabase/supabase-js";

export class AiRecruiterOrchestratorError extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "AiRecruiterOrchestratorError";
  }
}

export class AiRecruiterOrchestrator {
  constructor(
    private readonly repository: AiRecruiterRepository,
    private readonly companyFinder: CompanyFinderService,
    private readonly contactDiscovery: ContactDiscoveryEngine,
    private readonly companiesService: CompaniesService,
    private readonly outreachEngine: OutreachEngine,
    private readonly contactsClient: SupabaseClient,
    private readonly prospectAudit: ProspectAuditRepository,
  ) {}

  async parsePlan(prompt: string) {
    return parseAiRecruiterSearchPlan(prompt);
  }

  async createRun(context: AiRecruiterEngineContext, input: CreateAiRecruiterRunInput): Promise<AiRecruiterRun> {
    const config = getAiRecruiterConfig();
    const settings = aiRecruiterRunSettingsSchema.parse({
      outreachMode: input.searchPlan.outreach_mode,
      approvalMode: config.approvalMode,
      sendEnabled: config.sendEnabled,
    });

    return this.repository.createRun(context.organizationId, context.userId, input, settings);
  }

  async *runSession(
    context: AiRecruiterEngineContext,
    runId: string,
  ): AsyncGenerator<AiRecruiterStreamEvent> {
    const run = await this.repository.getRun(context.organizationId, runId);
    if (!run) throw new AiRecruiterOrchestratorError("Run niet gevonden.", "not_found");

    if (["completed", "cancelled"].includes(run.status)) {
      yield { type: "complete", run };
      return;
    }

    const config = getAiRecruiterConfig();
    const timeoutMs = config.runTimeoutMinutes * 60_000;
    const startedAt = Date.now();
    const counters: AiRecruiterRunCounters = {
      ...createInitialCounters(),
      ...run.counters,
    };
    let consecutiveFailures = 0;
    let runDiagnostics: RunDiagnostics | null = null;
    let finderJobId: string | undefined = undefined;

    const pipeline = new RecruiterPipelineTracker(run.pipelineSteps, () => undefined);

    const emitPipeline = (): AiRecruiterStreamEvent => ({
      type: "pipeline",
      steps: pipeline.getSnapshot(),
    });

    yield { type: "connected", runId };

    let eligibilitySummary: import("@/features/ai-recruiter/services/prospect-eligibility-pipeline.service").EligibilityRunSummary | null = null;

    try {
      await this.repository.updateRun(context.organizationId, runId, {
        status: "discovering",
        startedAt: new Date().toISOString(),
      });
      yield { type: "run_status", status: "discovering", message: "Recruitmentopdrachten zoeken…" };

      pipeline.startStep("discovery");
      yield emitPipeline();

      const plan = run.searchCriteria;
      const criteria = searchPlanToCompanyFinderCriteria(plan, run.prompt);

      if (!resolveProviderAvailability("tavily")) {
        const discoveryDurationMs = 0;
        const diagnostics = buildDiscoveryDiagnostics({
          plan,
          job: null,
          summary: emptyDiscoverySummary(),
          durationMs: discoveryDurationMs,
          validatedCount: 0,
        });
        runDiagnostics = diagnostics;
        pipeline.failStep("discovery", diagnostics.errorMessage ?? "Zoekprovider niet geconfigureerd", {
          processed: 0,
          errors: 1,
        });
        skipEnrichmentAndDownstream(pipeline, "Overgeslagen — provider niet geconfigureerd");
        pipeline.finalizeTerminalRun();
        yield emitPipeline();

        const outcome = resolveRunOutcome({ counters, diagnostics, draftsCreated: 0 });
        const uiMessage = buildRunFailureUiMessage(diagnostics, outcome.status);
        const finalRun = await this.repository.updateRun(context.organizationId, runId, {
          status: outcome.status,
          counters,
          pipelineSteps: pipeline.getSnapshot(),
          completedAt: new Date().toISOString(),
          errorMessage: uiMessage?.body ?? outcome.errorMessage,
          settings: buildRunSettingsWithDiagnostics(run.settings, diagnostics, finderJobId),
        });

        yield { type: "counters", counters };
        yield { type: "error", message: uiMessage?.body ?? outcome.errorMessage ?? "Provider niet geconfigureerd", diagnostics };
        yield { type: "complete", run: finalRun };
        return;
      }

      const finderJob = await this.companyFinder.createJob(context, criteria);
      finderJobId = finderJob.id;

      const savedCompanyIds: Array<{ companyId: string; itemId: string; name: string }> = [];
      let draftsCreated = 0;
      const discoveryStartedAt = Date.now();
      let discoverySummary = emptyDiscoverySummary();
      let completedFinderJob: CompanySearchJob | null = null;

      for await (const event of this.companyFinder.runJob(context, finderJob.id)) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new AiRecruiterOrchestratorError("Run timeout bereikt.", "timeout");
        }

        discoverySummary = mergeDiscoveryEvent(discoverySummary, event);

        if (event.type === "candidate") {
          counters.found += 1;

          if (event.skipped) {
            counters.skipped += 1;
            await this.repository.createRunItem(context.organizationId, runId, {
              externalCompanyData: { candidate: event.candidate },
              stage: "skipped",
              status: "skipped",
              rejectionReason: "Niet gevalideerd of duplicaat",
            });
            continue;
          }

          if (event.saved || event.updated) {
            counters.validated += 1;
            const company = await this.resolveCompany(context, event.candidate.name, event.candidate.website);
            const item = await this.repository.createRunItem(context.organizationId, runId, {
              companyId: company?.id ?? null,
              externalCompanyData: { candidate: event.candidate },
              stage: "validated",
              status: "processing",
              discoveryScore: event.candidate.leadScore ?? null,
            });

            if (company) {
              savedCompanyIds.push({ companyId: company.id as string, itemId: item.id, name: company.name });
              yield { type: "item", item: await this.repository.getRunItem(context.organizationId, item.id) as AiRecruiterRunItem };
            }
          }

          yield { type: "counters", counters };
        }

        if (event.type === "error") {
          consecutiveFailures += 1;
          console.error("[AI Recruiter] discovery provider error", {
            runId,
            message: event.message,
            provider: discoverySummary.providerName,
          });
        }

        if (event.type === "complete") {
          completedFinderJob = event.job;
        }
      }

      const discoveryDurationMs = Date.now() - discoveryStartedAt;
      const diagnostics = buildDiscoveryDiagnostics({
        plan,
        job: completedFinderJob,
        summary: discoverySummary,
        durationMs: discoveryDurationMs,
        validatedCount: counters.validated,
      });
      runDiagnostics = diagnostics;

      console.info("[AI Recruiter] discovery diagnostics", {
        runId,
        errorCode: diagnostics.errorCode,
        provider: diagnostics.providerName,
        responseCount: diagnostics.responseCount,
        normalizedCount: diagnostics.normalizedCount,
        rejectedCount: diagnostics.rejectedCount,
        validated: counters.validated,
        durationMs: discoveryDurationMs,
      });

      const discoveryProcessed = diagnostics.responseCount || counters.found;
      const discoveryRejected = diagnostics.rejectedCount || counters.skipped;

      if (discoveryStepFailed(diagnostics.errorCode)) {
        pipeline.failStep("discovery", diagnostics.errorMessage ?? "Discovery mislukt", {
          processed: discoveryProcessed,
          succeeded: 0,
          skipped: discoveryRejected,
          errors: 1,
        });
        skipEnrichmentAndDownstream(pipeline, "Overgeslagen — discovery mislukt");
        pipeline.finalizeTerminalRun();
        yield emitPipeline();

        const outcome = resolveRunOutcome({ counters, diagnostics, draftsCreated: 0 });
        const uiMessage = buildRunFailureUiMessage(diagnostics, outcome.status);
        const finalRun = await this.repository.updateRun(context.organizationId, runId, {
          status: outcome.status,
          counters,
          pipelineSteps: pipeline.getSnapshot(),
          completedAt: new Date().toISOString(),
          errorMessage: uiMessage?.body ?? outcome.errorMessage,
          settings: buildRunSettingsWithDiagnostics(run.settings, diagnostics, finderJobId),
        });

        yield { type: "counters", counters };
        yield { type: "error", message: uiMessage?.body ?? outcome.errorMessage ?? "Discovery mislukt", diagnostics };
        yield { type: "complete", run: finalRun };
        return;
      }

      pipeline.completeStep("discovery", {
        processed: discoveryProcessed,
        succeeded: counters.validated,
        skipped: discoveryRejected,
        message:
          counters.validated > 0
            ? `${counters.validated} recruitment opportunity(s) opgeslagen`
            : diagnostics.errorCode === "no_results"
              ? "Geen zoekresultaten"
              : "Geen opportunities opgeslagen na validatie",
      });
      pipeline.skipStep("crawler", "Niet gebruikt in AI Recruiter fast mode");
      yield emitPipeline();

      if (counters.validated === 0) {
        skipEnrichmentAndDownstream(pipeline, "Geen recruitment opportunities om te verwerken");
        pipeline.finalizeTerminalRun();
        yield emitPipeline();

        const outcome = resolveRunOutcome({ counters, diagnostics, draftsCreated: 0 });
        const uiMessage = buildRunFailureUiMessage(diagnostics, outcome.status);
        const finalRun = await this.repository.updateRun(context.organizationId, runId, {
          status: outcome.status,
          counters,
          pipelineSteps: pipeline.getSnapshot(),
          completedAt: new Date().toISOString(),
          errorMessage: uiMessage?.body ?? outcome.errorMessage,
          settings: buildRunSettingsWithDiagnostics(run.settings, diagnostics, finderJobId),
        });

        yield { type: "counters", counters };
        yield { type: "complete", run: finalRun };
        return;
      }

      await this.repository.updateRun(context.organizationId, runId, { status: "enriching" });
      yield { type: "run_status", status: "enriching" };

      pipeline.startStep("vacancies");
      pipeline.startStep("hiring_signals");
      yield emitPipeline();

      const qualifiedItems: Array<{
        itemId: string;
        companyId: string;
        company: Awaited<ReturnType<CompaniesService["getCompany"]>>;
        totalScore: number;
        opportunity: OpportunityAssessment;
        selected: SelectedDiscoveredContact;
        vacancies: VacancyEvidence[];
        contactStage: string;
        eligibility: ConceptEligibilityResult;
      }> = [];

      type CompanyContactContext = {
        companyId: string;
        itemId: string;
        name: string;
        company: Awaited<ReturnType<CompaniesService["getCompany"]>>;
        hiring: HiringIntelligenceProfile;
        opportunity: OpportunityAssessment;
        sales: SalesIntelligenceAssessment;
      };

      const companyContactContexts: CompanyContactContext[] = [];

      for (const { companyId, itemId, name } of savedCompanyIds) {
        if (Date.now() - startedAt > timeoutMs) break;

        try {
          const company = await this.companiesService.getCompany(context, toCompanyId(companyId));
          const hiring = computeHiringIntelligenceProfile(company, plan);
          const opportunity = computeOpportunityAssessment(company, plan);
          const sales = computeSalesIntelligence(company, hiring, plan);

          if (hiring.vacancyCount > 0) counters.withVacancies += 1;
          if (hiring.signals.length > 0) counters.withSignals += 1;

          console.info("[SalesIntelligence] assessment", {
            companyId,
            companyName: name,
            salesScore: sales.salesScore,
            tier: sales.tier,
            breakdown: sales.breakdown,
            why: sales.why.slice(0, 3),
          });

          console.info("[Opportunity] assessment", {
            companyId,
            companyName: name,
            opportunityScore: opportunity.opportunityScore,
            urgency: opportunity.urgency,
            rolesSought: opportunity.rolesSought,
            hiringScore: hiring.hiringScore,
            vacancyCount: hiring.vacancyCount,
          });

          companyContactContexts.push({
            companyId,
            itemId,
            name,
            company,
            hiring,
            opportunity,
            sales,
          });
        } catch (error) {
          consecutiveFailures += 1;
          counters.failed += 1;
          console.error("[ContactFinder] company context failed", {
            companyId,
            itemId,
            error: error instanceof Error ? error.message : error,
          });
          if (consecutiveFailures >= config.consecutiveProviderFailuresKillSwitch) {
            throw new AiRecruiterOrchestratorError("Kill switch: te veel opeenvolgende fouten.", "provider_kill_switch");
          }
        }
      }

      console.info("[ContactFinder] DEBUG overview — start", {
        companiesReceived: savedCompanyIds.length,
        validatedCounter: counters.validated,
        companiesPreparedForContactFinder: companyContactContexts.length,
      });

      if (counters.validated > 0 && savedCompanyIds.length === 0) {
        console.error("[ContactFinder] BUG: validated > 0 maar geen company_id op run items", {
          validated: counters.validated,
          savedCompanyIds: savedCompanyIds.length,
        });
      }

      if (companyContactContexts.length === 0 && savedCompanyIds.length > 0) {
        console.error("[ContactFinder] BUG: geen company context — Contact Finder wordt niet uitgevoerd", {
          savedCompanyIds: savedCompanyIds.length,
        });
      }

      pipeline.completeStep("vacancies", { succeeded: counters.withVacancies });
      pipeline.completeStep("hiring_signals", { succeeded: counters.withSignals });
      yield emitPipeline();

      pipeline.startStep("ai_analysis");
      yield emitPipeline();

      let aiAnalysisSucceeded = 0;
      const intelligenceEngine = await createRecruitmentIntelligenceEngine();
      const analysisByCompanyId = new Map<string, RecruitmentIntelligenceAnalysis>();

      for (const { companyId, itemId } of savedCompanyIds) {
        try {
          const record = await intelligenceEngine.ensureFreshAnalysis(context, companyId, {
            runItemId: itemId,
          });
          if (record) {
            aiAnalysisSucceeded += 1;
            analysisByCompanyId.set(companyId, record.analysis);
          }
        } catch (error) {
          console.error("[RecruitmentIntelligence] analyse mislukt", {
            companyId,
            itemId,
            error: error instanceof Error ? error.message : error,
          });
        }
      }

      pipeline.completeStep("ai_analysis", {
        processed: savedCompanyIds.length,
        succeeded: aiAnalysisSucceeded,
        errors: savedCompanyIds.length - aiAnalysisSucceeded,
        message: `${aiAnalysisSucceeded}/${savedCompanyIds.length} recruitment intelligence analyses`,
      });
      yield emitPipeline();

      await this.repository.updateRun(context.organizationId, runId, { status: "finding_contacts" });
      yield { type: "run_status", status: "finding_contacts", message: "Contacten zoeken…" };

      pipeline.startStep("contact_finder");
      yield emitPipeline();

      const suppressedEmails = await this.loadSuppressedEmails(context.organizationId);
      const bouncedEmails = await this.loadBouncedEmails(context.organizationId);

      const contactStats = {
        processed: 0,
        personal: 0,
        general: 0,
        missing: 0,
        lookupFailed: 0,
        providerErrors: 0,
        providersInvoked: 0,
        rejected: 0,
        totalDurationMs: 0,
      };

      type DiscoveryEntry = {
        itemId: string;
        companyId: string;
        hiring: HiringIntelligenceProfile;
        result: Awaited<ReturnType<ContactDiscoveryEngine["discoverForCompany"]>>;
      };

      const discoveryByItem = new Map<string, DiscoveryEntry>();

      await runWithConcurrency(companyContactContexts, 5, async (entry) => {
        const discoveryStarted = Date.now();
        contactStats.processed += 1;

        console.info("[ContactFinder] START company", {
          companyId: entry.companyId,
          companyName: entry.name,
        });

        try {
          const result = await this.contactDiscovery.discoverForCompany(
            { ...context, runId, runItemId: entry.itemId },
            {
              companyId: entry.companyId,
              targetRoles: plan.contact_roles,
              suppressedEmails,
              bouncedEmails,
            },
          );

          contactStats.totalDurationMs += Date.now() - discoveryStarted;
          contactStats.providersInvoked += result.traces.length;
          contactStats.rejected += result.traces.reduce((sum, trace) => sum + trace.rejectedCount, 0);

          for (const trace of result.traces) {
            console.info("[ContactFinder] provider", {
              companyId: entry.companyId,
              companyName: entry.name,
              provider: trace.provider,
              providerResult: trace.rawResultCount,
              normalized: trace.normalizedCount,
              accepted: trace.validCount,
              rejected: trace.rejectedCount,
              reason:
                trace.error
                ?? trace.rejectionReasons.map((r) => r.message).join("; ")
                ?? null,
            });
          }

          if (result.traces.length === 0) {
            console.error("[ContactFinder] BUG: geen provider aangeroepen", {
              companyId: entry.companyId,
              companyName: entry.name,
            });
          }

          if (result.stage === "contact_found") contactStats.personal += 1;
          else if (result.stage === "general_mailbox_found") contactStats.general += 1;
          else if (result.stage === "blocked_missing_contact") contactStats.missing += 1;
          else if (result.stage === "contact_lookup_failed") {
            contactStats.lookupFailed += 1;
            if (result.traces.some((trace) => trace.error)) {
              contactStats.providerErrors += 1;
            }
          }

          console.info("[ContactFinder] END company", {
            companyId: entry.companyId,
            companyName: entry.name,
            stage: result.stage,
            selectedEmail: result.selected?.email ?? null,
            providerCount: result.traces.length,
          });

          discoveryByItem.set(entry.itemId, {
            itemId: entry.itemId,
            companyId: entry.companyId,
            hiring: entry.hiring,
            result,
          });
        } catch (error) {
          contactStats.lookupFailed += 1;
          contactStats.providerErrors += 1;
          counters.failed += 1;

          console.error("[ContactFinder] END company — lookup failed", {
            companyId: entry.companyId,
            companyName: entry.name,
            error: error instanceof Error ? error.message : error,
          });

          discoveryByItem.set(entry.itemId, {
            itemId: entry.itemId,
            companyId: entry.companyId,
            hiring: entry.hiring,
            result: {
              stage: "contact_lookup_failed",
              selected: null,
              alternatives: [],
              traces: [],
              errorMessage: error instanceof Error ? error.message : "Contact lookup mislukt",
            },
          });
        }
      });

      console.info("[ContactFinder] DEBUG overview — after discovery", {
        companiesReceived: savedCompanyIds.length,
        companiesProcessed: contactStats.processed,
        providersInvoked: contactStats.providersInvoked,
        contactsFound: contactStats.personal,
        mailboxesFound: contactStats.general,
        noContact: contactStats.missing,
        rejected: contactStats.rejected,
        lookupFailed: contactStats.lookupFailed,
      });

      pipeline.startStep("lead_score");

      const recruiterConfig = getAiRecruiterConfig();
      const eligibilityDecisions: import("@/features/ai-recruiter/domain/concept-eligibility.types").ConceptEligibilityResult[] = [];

      for (const entry of companyContactContexts) {
        const discovery = discoveryByItem.get(entry.itemId);
        if (!discovery) {
          console.error("[ContactFinder] BUG: geen discovery result", {
            companyId: entry.companyId,
            companyName: entry.name,
            itemId: entry.itemId,
          });
          continue;
        }

        const { result, hiring } = discovery;
        const { opportunity, sales, company } = entry;
        const analysis = analysisByCompanyId.get(entry.companyId) ?? null;
        const salesFields = salesToScoreBreakdownFields(sales);

        const businessModel = classifyBusinessModel({
          name: company.name,
          url: company.website,
          description: company.aiSummary,
          sector: company.sector,
          excludeRecruitmentAgencies: recruiterConfig.excludeRecruitmentAgencies,
        });

        const pipelineDecision = evaluateProspectPipeline({
          company,
          plan,
          hiring,
          analysis,
          contact: result.selected,
          contactStage: result.stage,
          contactRejectionReason: result.errorMessage,
        });

        const decisionFields = prospectDecisionToBreakdownFields(
          mapScoreToDecision(pipelineDecision.eligibility.score),
        );

        const identityBlocked =
          isGenericCompanyLabel(company.name)
          || isExcludedBusinessModel(businessModel.classification, recruiterConfig.excludeRecruitmentAgencies);

        eligibilityDecisions.push(pipelineDecision.eligibility);

        const contactDiscoveryPayload = {
          contactDiscovery: {
            stage: result.stage,
            selected: result.selected,
            alternatives: result.alternatives,
            errorMessage: result.errorMessage,
          },
          eligibility: pipelineDecision.eligibility,
          vacancyEvidence: pipelineDecision.vacancies,
        };

        if (result.stage === "contact_found") {
          counters.contactFound += 1;
        } else if (result.stage === "general_mailbox_found") {
          counters.generalMailboxFound += 1;
        } else if (result.stage === "blocked_missing_contact") {
          counters.blockedMissingContact += 1;
        }

        const scoreBreakdown = {
          companyFit: pipelineDecision.eligibility.score,
          hiring: hiring.hiringScore,
          opportunity: pipelineDecision.aiOpportunityScore ?? opportunity.opportunityScore,
          contact: result.selected ? (result.selected.isGeneralMailbox ? 12 : 20) : 0,
          personalization: 0,
          outreachReadiness: pipelineDecision.eligibility.eligible ? 50 : 0,
          explanations: [
            ...pipelineDecision.eligibility.acceptedRules,
            ...pipelineDecision.eligibility.rejectedRules.map((rule) => `Afgewezen: ${rule}`),
          ],
          opportunityWhy: opportunity.why,
          rolesSought: opportunity.rolesSought,
          urgency: opportunity.urgency,
          bestApproach: opportunity.bestApproach,
          recruitmentPotential: opportunity.recruitmentPotential,
          recruitmentPotentialMotivation: opportunity.recruitmentPotentialMotivation,
          recruitmentIntelligenceScore: pipelineDecision.aiOpportunityScore ?? undefined,
          ...salesFields,
          ...decisionFields,
          officialName: company.name,
          businessClassification: businessModel.classification,
          identityUnresolved: isGenericCompanyLabel(company.name),
        };

        const effectivelyEligible = pipelineDecision.eligibility.eligible && !identityBlocked;

        if (!effectivelyEligible) {
          const updatedItem = await this.repository.updateRunItem(context.organizationId, entry.itemId, {
            stage: result.stage,
            status: result.stage === "contact_lookup_failed" ? "failed" : "skipped",
            hiringScore: hiring.hiringScore,
            contactScore: result.selected ? 12 : 0,
            totalScore: pipelineDecision.eligibility.score,
            scoreBreakdown,
            rejectionReason: identityBlocked
              ? `Uitgesloten: ${businessModel.classification} / generieke identiteit`
              : pipelineDecision.eligibility.userMessage,
            warnings: hiring.warnings,
            selectedContactId: result.selected?.contactId ?? null,
            externalCompanyData: contactDiscoveryPayload,
          });

          await this.prospectAudit.upsertDecision({
            organizationId: context.organizationId,
            runId,
            runItemId: entry.itemId,
            company,
            eligibility: pipelineDecision.eligibility,
            vacancies: pipelineDecision.vacancies,
            contact: result.selected,
            contactStage: result.stage,
            conceptStatus: "skipped",
          });

          if (result.stage !== "contact_lookup_failed") {
            counters.skipped += 1;
          }

          yield { type: "item", item: updatedItem };
          continue;
        }

        const updatedItem = await this.repository.updateRunItem(context.organizationId, entry.itemId, {
          stage: result.stage,
          status: "completed",
          hiringScore: hiring.hiringScore,
          contactScore: result.selected?.isGeneralMailbox ? 12 : 20,
          outreachScore: 50,
          totalScore: pipelineDecision.eligibility.score,
          scoreBreakdown,
          rejectionReason: null,
          warnings: hiring.warnings,
          selectedContactId: result.selected?.contactId ?? null,
          externalCompanyData: contactDiscoveryPayload,
        });

        await this.prospectAudit.upsertDecision({
          organizationId: context.organizationId,
          runId,
          runItemId: entry.itemId,
          company,
          eligibility: pipelineDecision.eligibility,
          vacancies: pipelineDecision.vacancies,
          contact: result.selected,
          contactStage: result.stage,
          conceptStatus: "pending",
        });

        yield { type: "item", item: updatedItem };

        if (result.selected) {
          qualifiedItems.push({
            itemId: entry.itemId,
            companyId: entry.companyId,
            company,
            totalScore: pipelineDecision.eligibility.score,
            opportunity,
            selected: result.selected,
            vacancies: pipelineDecision.vacancies,
            contactStage: result.stage,
            eligibility: pipelineDecision.eligibility,
          });
        }
      }

      eligibilitySummary = summarizeEligibilityDecisions(
        eligibilityDecisions,
        recruiterConfig.conceptScoreThreshold,
      );

      const avgDuration =
        contactStats.processed > 0
          ? Math.round(contactStats.totalDurationMs / contactStats.processed)
          : 0;

      pipeline.completeStep("contact_finder", {
        processed: contactStats.processed,
        succeeded: contactStats.personal + contactStats.general,
        skipped: contactStats.missing + contactStats.lookupFailed,
        errors: contactStats.providerErrors,
        message: [
          `ontvangen ${savedCompanyIds.length}`,
          `verwerkt ${contactStats.processed}`,
          `providers ${contactStats.providersInvoked}`,
          `${contactStats.personal} contact`,
          `${contactStats.general} mailbox`,
          `${contactStats.missing} geen contact`,
          `${contactStats.rejected} rejected`,
          `gem. ${avgDuration}ms`,
        ].join(" · "),
      });
      pipeline.completeStep("lead_score", { succeeded: qualifiedItems.length });
      yield emitPipeline();
      yield { type: "counters", counters };

      await this.repository.updateRun(context.organizationId, runId, { status: "drafting" });
      yield { type: "run_status", status: "drafting" };
      pipeline.startStep("drafts");

      qualifiedItems.sort((a, b) => b.totalScore - a.totalScore);

      const eligibleProspects: EligibleProspectForConcept[] = qualifiedItems
        .filter((entry) => entry.eligibility.eligible)
        .map((entry) => ({
          itemId: entry.itemId,
          companyId: entry.companyId,
          company: entry.company,
          selected: entry.selected,
          vacancies: entry.vacancies,
          contactStage: entry.contactStage,
          opportunity: entry.opportunity,
          eligibility: entry.eligibility,
        }));

      console.info("[ConceptGenerationDispatch] eligible prospects", {
        run_id: runId,
        qualified_items: qualifiedItems.length,
        eligible_prospects: eligibleProspects.length,
        maximum_drafts: plan.maximum_drafts,
      });

      let conceptDispatchResult: Awaited<ReturnType<typeof dispatchConceptGeneration>> | null = null;

      try {
        conceptDispatchResult = await dispatchConceptGeneration({
          context,
          runId,
          plan,
          eligibleProspects,
          outreachEngine: this.outreachEngine,
          repository: this.repository,
          prospectAudit: this.prospectAudit,
          maxConcepts: plan.maximum_drafts,
        });
      } finally {
        if (!conceptDispatchResult) {
          conceptDispatchResult = {
            results: [],
            counters: {
              prospectsEvaluated: eligibleProspects.length,
              prospectsEligible: eligibleProspects.length,
              conceptsStarted: 0,
              conceptsCreated: 0,
              conceptsFailed: eligibleProspects.length,
              conceptsSkipped: 0,
              conceptsPending: 0,
              conceptsGenerating: 0,
            },
          };
        }
      }

      draftsCreated = conceptDispatchResult.counters.conceptsCreated;
      counters.draftsCreated = conceptDispatchResult.counters.conceptsCreated;
      counters.failed += conceptDispatchResult.counters.conceptsFailed;

      for (const result of conceptDispatchResult.results) {
        if (!result.success) continue;
        const item = await this.repository.getRunItem(context.organizationId, result.itemId);
        if (item) yield { type: "item", item };
      }

      pipeline.completeStep("drafts", {
        succeeded: conceptDispatchResult.counters.conceptsCreated,
        processed: conceptDispatchResult.counters.prospectsEligible,
        skipped: conceptDispatchResult.counters.conceptsSkipped,
        errors: conceptDispatchResult.counters.conceptsFailed,
        message: [
          `eligible ${conceptDispatchResult.counters.prospectsEligible}`,
          `gestart ${conceptDispatchResult.counters.conceptsStarted}`,
          `aangemaakt ${conceptDispatchResult.counters.conceptsCreated}`,
          `mislukt ${conceptDispatchResult.counters.conceptsFailed}`,
        ].join(" · "),
      });
      pipeline.skipStep("sending", "Handmatige goedkeuring vereist");
      pipeline.skipStep("follow_up", "Na verzending");
      if (counters.draftsCreated > 0) {
        pipeline.completeStep("approval", { message: "Wacht op goedkeuring" });
      } else {
        pipeline.skipStep("approval", "Geen concepten om goed te keuren");
      }
      pipeline.finalizeTerminalRun();
      yield emitPipeline();

      const outcome = resolveRunOutcome({
        counters,
        diagnostics: runDiagnostics!,
        draftsCreated: counters.draftsCreated,
        eligibilitySummary,
        conceptCounters: conceptDispatchResult?.counters ?? null,
      });
      const uiMessage =
        outcome.errorMessage && runDiagnostics
          ? buildRunFailureUiMessage(runDiagnostics, outcome.status)
          : null;

      const finalRun = await this.repository.updateRun(context.organizationId, runId, {
        status: outcome.status,
        counters,
        pipelineSteps: pipeline.getSnapshot(),
        completedAt: new Date().toISOString(),
        errorMessage: outcome.errorMessage ?? uiMessage?.body ?? null,
        settings: runDiagnostics
          ? buildRunSettingsWithDiagnostics(run.settings, runDiagnostics, finderJobId)
          : run.settings,
      });

      yield { type: "counters", counters };
      if (outcome.errorMessage && outcome.status !== "awaiting_approval") {
        yield { type: "error", message: outcome.errorMessage, diagnostics: runDiagnostics };
      }
      yield { type: "complete", run: finalRun };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Run mislukt";
      pipeline.finalizeTerminalRun("Afgebroken door fout");
      const failedRun = await this.repository.updateRun(context.organizationId, runId, {
        status: error instanceof AiRecruiterOrchestratorError && error.code === "timeout" ? "partially_completed" : "failed",
        counters,
        pipelineSteps: pipeline.getSnapshot(),
        completedAt: new Date().toISOString(),
        errorMessage: message,
        settings: runDiagnostics
          ? buildRunSettingsWithDiagnostics(run.settings, runDiagnostics, finderJobId)
          : run.settings,
      });

      yield { type: "error", message, diagnostics: runDiagnostics };
      yield { type: "complete", run: failedRun };
    }
  }

  async cancelRun(context: AiRecruiterEngineContext, runId: string): Promise<AiRecruiterRun> {
    return this.repository.updateRun(context.organizationId, runId, {
      status: "cancelled",
      completedAt: new Date().toISOString(),
    });
  }

  async listRuns(context: AiRecruiterEngineContext): Promise<AiRecruiterRun[]> {
    return this.repository.listRuns(context.organizationId);
  }

  async getRun(context: AiRecruiterEngineContext, runId: string): Promise<AiRecruiterRun | null> {
    return this.repository.getRun(context.organizationId, runId);
  }

  async listItems(context: AiRecruiterEngineContext, runId: string): Promise<AiRecruiterRunItem[]> {
    return this.repository.listRunItems(context.organizationId, runId);
  }

  private async resolveCompany(
    context: AiRecruiterEngineContext,
    name: string,
    website: string | null,
  ) {
    const results = await this.companiesService.searchCompanies(context, { query: name, limit: 5 });
    if (website) {
      const domain = website.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase();
      const match = results.find((c) => c.domain?.toLowerCase() === domain || c.website?.includes(domain ?? ""));
      if (match) return match;
    }
    return results[0] ?? null;
  }

  private async loadSuppressedEmails(organizationId: string): Promise<Set<string>> {
    const { data } = await this.contactsClient
      .from("outreach_suppressions")
      .select("email")
      .eq("organization_id", organizationId);

    return new Set((data ?? []).map((row) => (row.email as string).toLowerCase()));
  }

  private async loadBouncedEmails(organizationId: string): Promise<Set<string>> {
    const { data } = await this.contactsClient
      .from("outreach_messages")
      .select("recipient_email")
      .eq("organization_id", organizationId)
      .eq("status", "bounced");

    return new Set((data ?? []).map((row) => (row.recipient_email as string).toLowerCase()));
  }
}

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;

  let index = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      if (!current) continue;
      await worker(current);
    }
  });

  await Promise.allSettled(workers);
}

export function createInitialRunCounters(): AiRecruiterRunCounters {
  return createInitialCounters();
}

export function createRunPipelineSteps() {
  return createInitialPipelineSteps();
}

export { priorityFromTotalScore };
