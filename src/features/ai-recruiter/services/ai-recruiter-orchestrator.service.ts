import "server-only";

import { toCompanyId } from "@/features/companies/domain";
import type { CompaniesService } from "@/features/companies/services/companies.service";
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
import { generateRecruiterOutreachDraft } from "@/features/ai-recruiter/services/draft-generator.service";
import { computeHiringIntelligenceProfile } from "@/features/ai-recruiter/services/hiring-intelligence-scorer.service";
import { computeLeadScore, type ContactScoreInput } from "@/features/ai-recruiter/services/lead-scoring.service";
import { RecruiterPipelineTracker } from "@/features/ai-recruiter/services/recruiter-pipeline-tracker";
import {
  parseAiRecruiterSearchPlan,
  searchPlanToCompanyFinderCriteria,
} from "@/features/ai-recruiter/services/search-plan-parser.service";
import type { CompanyFinderService } from "@/features/company-finder/services/company-finder.service";
import type { ContactFinderService } from "@/features/contact-finder/services/contact-finder.service";
import { OutreachEngine, OutreachEngineError } from "@/features/outreach-engine/services/outreach-engine.service";
import {
  selectRecipient,
  type OutreachContactRecord,
} from "@/features/outreach-engine/services/recipient-selection.service";
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
    private readonly contactFinder: ContactFinderService,
    private readonly companiesService: CompaniesService,
    private readonly outreachEngine: OutreachEngine,
    private readonly contactsClient: SupabaseClient,
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
    const counters = { ...run.counters };
    let consecutiveFailures = 0;

    const pipeline = new RecruiterPipelineTracker(run.pipelineSteps, () => undefined);

    const emitPipeline = (): AiRecruiterStreamEvent => ({
      type: "pipeline",
      steps: pipeline.getSnapshot(),
    });

    yield { type: "connected", runId };

    try {
      await this.repository.updateRun(context.organizationId, runId, {
        status: "discovering",
        startedAt: new Date().toISOString(),
      });
      yield { type: "run_status", status: "discovering", message: "Bedrijven ontdekken…" };

      pipeline.startStep("discovery");
      yield emitPipeline();

      const plan = run.searchCriteria;
      const criteria = searchPlanToCompanyFinderCriteria(plan, run.prompt);
      const finderJob = await this.companyFinder.createJob(context, criteria);

      const savedCompanyIds: Array<{ companyId: string; itemId: string; name: string }> = [];
      let draftsCreated = 0;

      for await (const event of this.companyFinder.runJob(context, finderJob.id)) {
        if (Date.now() - startedAt > timeoutMs) {
          throw new AiRecruiterOrchestratorError("Run timeout bereikt.", "timeout");
        }

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
        }
      }

      pipeline.completeStep("discovery", { processed: counters.found, succeeded: counters.validated, skipped: counters.skipped });
      yield emitPipeline();

      await this.repository.updateRun(context.organizationId, runId, { status: "enriching" });
      yield { type: "run_status", status: "enriching" };

      pipeline.startStep("vacancies");
      pipeline.startStep("hiring_signals");
      yield emitPipeline();

      const qualifiedItems: Array<{ itemId: string; companyId: string; totalScore: number }> = [];

      for (const { companyId, itemId } of savedCompanyIds) {
        if (Date.now() - startedAt > timeoutMs) break;

        try {
          const company = await this.companiesService.getCompany(context, toCompanyId(companyId));
          const hiring = computeHiringIntelligenceProfile(company, plan);

          if (hiring.vacancyCount > 0) counters.withVacancies += 1;
          if (hiring.signals.length > 0) counters.withSignals += 1;

          if (plan.vacancy_required && hiring.vacancyCount === 0) {
            await this.repository.updateRunItem(context.organizationId, itemId, {
              stage: "skipped",
              status: "skipped",
              hiringScore: hiring.hiringScore,
              rejectionReason: "Vacature vereist maar niet gevonden",
              warnings: hiring.warnings,
            });
            counters.skipped += 1;
            continue;
          }

          if (hiring.hiringScore < plan.minimum_hiring_score) {
            await this.repository.updateRunItem(context.organizationId, itemId, {
              stage: "scored",
              status: "skipped",
              hiringScore: hiring.hiringScore,
              rejectionReason: `Hiring score ${hiring.hiringScore} onder minimum ${plan.minimum_hiring_score}`,
              warnings: hiring.warnings,
            });
            counters.skipped += 1;
            continue;
          }

          await this.repository.updateRun(context.organizationId, runId, { status: "finding_contacts" });

          pipeline.startStep("contact_finder");
          const contactJob = await this.contactFinder.createJob(context, {
            companyId,
            targetRoles: plan.contact_roles,
          });

          for await (const _ of this.contactFinder.runJob(context, contactJob.id)) {
            /* consume stream */
          }

          const contacts = await this.loadContacts(context.organizationId, companyId);
          const suppressed = new Set<string>();
          const bounced = new Set<string>();
          const recentCompanies = new Set<string>();
          const activeEmails = new Set<string>();

          const recipient = selectRecipient({
            company,
            contacts,
            suppressedEmails: suppressed,
            bouncedEmails: bounced,
            recentlyContactedCompanyIds: recentCompanies,
          });

          let contactInput: ContactScoreInput = {
            hasContact: false,
            contactName: null,
            contactEmail: null,
            verificationStatus: "unknown",
            confidence: null,
          };

          if (recipient.ok) {
            counters.contactFound += 1;
            contactInput = {
              hasContact: true,
              contactName: recipient.recipientName,
              contactEmail: recipient.recipientEmail,
              verificationStatus: recipient.source === "contact" ? "likely" : "catch_all",
              confidence: 0.7,
            };
          } else {
            await this.repository.updateRunItem(context.organizationId, itemId, {
              stage: "skipped",
              status: "skipped",
              hiringScore: hiring.hiringScore,
              rejectionReason: recipient.reason,
              warnings: [...hiring.warnings, recipient.reason],
            });
            counters.skipped += 1;
            continue;
          }

          pipeline.startStep("lead_score");
          const leadScore = computeLeadScore(company, hiring, contactInput, plan);

          await this.repository.updateRunItem(context.organizationId, itemId, {
            stage: "scored",
            status: leadScore.priority === "Reject" ? "skipped" : "completed",
            hiringScore: hiring.hiringScore,
            contactScore: leadScore.contactScore,
            outreachScore: leadScore.outreachReadinessScore,
            totalScore: leadScore.totalScore,
            scoreBreakdown: leadScore.breakdown,
            rejectionReason: leadScore.priority === "Reject" ? "Score onder drempel" : null,
            warnings: hiring.warnings,
            selectedContactId: recipient.contactId,
          });

          if (leadScore.priority === "Reject") {
            counters.skipped += 1;
            continue;
          }

          qualifiedItems.push({ itemId, companyId, totalScore: leadScore.totalScore });
        } catch (error) {
          consecutiveFailures += 1;
          counters.failed += 1;
          if (consecutiveFailures >= config.consecutiveProviderFailuresKillSwitch) {
            throw new AiRecruiterOrchestratorError("Kill switch: te veel opeenvolgende fouten.", "provider_kill_switch");
          }
        }
      }

      pipeline.completeStep("vacancies", { succeeded: counters.withVacancies });
      pipeline.completeStep("hiring_signals", { succeeded: counters.withSignals });
      pipeline.completeStep("contact_finder", { succeeded: counters.contactFound });
      pipeline.completeStep("lead_score", { succeeded: qualifiedItems.length });
      yield emitPipeline();

      await this.repository.updateRun(context.organizationId, runId, { status: "drafting" });
      yield { type: "run_status", status: "drafting" };
      pipeline.startStep("drafts");

      qualifiedItems.sort((a, b) => b.totalScore - a.totalScore);
      const topItems = qualifiedItems.slice(0, plan.maximum_drafts);

      for (const { itemId, companyId } of topItems) {
        if (draftsCreated >= plan.maximum_drafts) break;

        try {
          const company = await this.companiesService.getCompany(context, toCompanyId(companyId));
          const hiring = computeHiringIntelligenceProfile(company, plan);
          const contacts = await this.loadContacts(context.organizationId, companyId);
          const recipient = selectRecipient({
            company,
            contacts,
            suppressedEmails: new Set(),
            bouncedEmails: new Set(),
            recentlyContactedCompanyIds: new Set(),
          });

          if (!recipient.ok) continue;

          const draft = await generateRecruiterOutreachDraft(company, recipient.recipientName, hiring);

          let outreachMessageId: string | null = null;
          try {
            const message = await this.outreachEngine.createDraft(context, { companyId, contactId: recipient.contactId });
            outreachMessageId = message.id;
            await this.outreachEngine.updateDraft(context, message.id, {
              subject: draft.recommendedSubject,
              bodyText: draft.bodyText,
            });
          } catch (error) {
            if (error instanceof OutreachEngineError && error.code === "duplicate") {
              counters.skipped += 1;
              continue;
            }
            throw error;
          }

          draftsCreated += 1;
          counters.draftsCreated += 1;

          const updatedItem = await this.repository.updateRunItem(context.organizationId, itemId, {
            stage: "draft_created",
            status: "completed",
            outreachMessageId,
            warnings: draft.warnings,
          });

          yield { type: "item", item: updatedItem };
        } catch {
          counters.failed += 1;
        }
      }

      pipeline.completeStep("drafts", { succeeded: counters.draftsCreated });
      pipeline.skipStep("sending", "Handmatige goedkeuring vereist");
      pipeline.skipStep("follow_up", "Na verzending");
      pipeline.completeStep("approval", { message: "Wacht op goedkeuring" });
      yield emitPipeline();

      const finalStatus =
        counters.failed > 0 && counters.draftsCreated > 0
          ? "partially_completed"
          : counters.draftsCreated > 0
            ? "awaiting_approval"
            : counters.validated > 0
              ? "partially_completed"
              : "failed";

      const finalRun = await this.repository.updateRun(context.organizationId, runId, {
        status: finalStatus,
        counters,
        pipelineSteps: pipeline.getSnapshot(),
        completedAt: new Date().toISOString(),
        errorMessage: finalStatus === "failed" ? "Geen geschikte prospects gevonden." : null,
      });

      yield { type: "counters", counters };
      yield { type: "complete", run: finalRun };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Run mislukt";
      const failedRun = await this.repository.updateRun(context.organizationId, runId, {
        status: error instanceof AiRecruiterOrchestratorError && error.code === "timeout" ? "partially_completed" : "failed",
        counters,
        pipelineSteps: pipeline.getSnapshot(),
        completedAt: new Date().toISOString(),
        errorMessage: message,
      });

      yield { type: "error", message };
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

  private async loadContacts(organizationId: string, companyId: string): Promise<OutreachContactRecord[]> {
    const { data } = await this.contactsClient
      .from("contacts")
      .select("id, first_name, last_name, job_title, email, confidence, outreach_opt_out")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId);

    return (data ?? []).map((row) => ({
      id: row.id as string,
      firstName: row.first_name as string,
      lastName: row.last_name as string,
      jobTitle: (row.job_title as string) ?? null,
      email: (row.email as string) ?? null,
      confidence: (row.confidence as number) ?? null,
      outreachOptOut: Boolean(row.outreach_opt_out),
    }));
  }
}

export function createInitialRunCounters(): AiRecruiterRunCounters {
  return createInitialCounters();
}

export function createRunPipelineSteps() {
  return createInitialPipelineSteps();
}

export { priorityFromTotalScore };
