import type { CompaniesService, CompaniesServiceContext } from "@/features/companies/services/companies.service";
import type {
  CompanyFinderCriteria,
  CompanyFinderProgress,
  CompanySearchJob,
  ExternalCompanyCandidate,
} from "@/features/company-finder/domain";
import type { CompanySearchJobRepository } from "@/features/company-finder/repositories";
import { LeadIntelligenceEngine } from "@/features/lead-intelligence/services/lead-intelligence-engine.service";

export type CompanyFinderServiceContext = CompaniesServiceContext;

export type CompanyFinderRunEvent =
  | { type: "progress"; progress: CompanyFinderProgress }
  | { type: "event"; eventType: string; payload: Record<string, unknown> }
  | { type: "candidate"; candidate: ExternalCompanyCandidate; saved: boolean; updated: boolean; skipped: boolean }
  | { type: "pipeline"; event: import("@/features/company-finder/pipeline/pipeline-viewer.types").PipelineStreamEvent }
  | { type: "complete"; job: CompanySearchJob }
  | { type: "error"; message: string };

/** Facade over Lead Intelligence Engine — backward-compatible Company Finder API. */
export class CompanyFinderService {
  private readonly engine: LeadIntelligenceEngine;

  constructor(
    jobRepository: CompanySearchJobRepository,
    companiesService: CompaniesService,
  ) {
    this.engine = new LeadIntelligenceEngine(jobRepository, companiesService);
  }

  async createJob(
    context: CompanyFinderServiceContext,
    criteria: CompanyFinderCriteria,
  ): Promise<CompanySearchJob> {
    return this.engine.createJob(context, criteria);
  }

  async *runJob(
    context: CompanyFinderServiceContext,
    jobId: string,
  ): AsyncGenerator<CompanyFinderRunEvent> {
    yield* this.engine.runJob(context, jobId);
  }

  async getJob(
    context: CompanyFinderServiceContext,
    jobId: string,
  ): Promise<CompanySearchJob> {
    return this.engine.getJob(context, jobId);
  }
}
