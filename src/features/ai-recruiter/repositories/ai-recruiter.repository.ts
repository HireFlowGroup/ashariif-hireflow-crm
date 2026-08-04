import type {
  AiRecruiterEngineContext,
  AiRecruiterRun,
  AiRecruiterRunCounters,
  AiRecruiterRunItem,
  AiRecruiterRunSettings,
  AiRecruiterRunStatus,
  AiRecruiterSearchPlan,
  CreateAiRecruiterRunInput,
  ReplyClassification,
} from "@/features/ai-recruiter/domain/types";

export interface AiRecruiterRepository {
  createRun(
    organizationId: string,
    userId: string,
    input: CreateAiRecruiterRunInput,
    settings: AiRecruiterRunSettings,
  ): Promise<AiRecruiterRun>;

  updateRun(
    organizationId: string,
    runId: string,
    updates: Partial<{
      status: AiRecruiterRunStatus;
      counters: AiRecruiterRunCounters;
      pipelineSteps: AiRecruiterRun["pipelineSteps"];
      startedAt: string;
      completedAt: string;
      errorMessage: string | null;
    }>,
  ): Promise<AiRecruiterRun>;

  getRun(organizationId: string, runId: string): Promise<AiRecruiterRun | null>;

  listRuns(organizationId: string, limit?: number): Promise<AiRecruiterRun[]>;

  createRunItem(
    organizationId: string,
    runId: string,
    input: {
      companyId?: string | null;
      externalCompanyData?: Record<string, unknown>;
      stage?: AiRecruiterRunItem["stage"];
      status?: AiRecruiterRunItem["status"];
      discoveryScore?: number | null;
      rejectionReason?: string | null;
      warnings?: string[];
    },
  ): Promise<AiRecruiterRunItem>;

  updateRunItem(
    organizationId: string,
    itemId: string,
    updates: Partial<{
      companyId: string | null;
      stage: AiRecruiterRunItem["stage"];
      status: AiRecruiterRunItem["status"];
      discoveryScore: number | null;
      hiringScore: number | null;
      contactScore: number | null;
      outreachScore: number | null;
      totalScore: number | null;
      scoreBreakdown: AiRecruiterRunItem["scoreBreakdown"];
      rejectionReason: string | null;
      warnings: string[];
      selectedContactId: string | null;
      outreachMessageId: string | null;
    }>,
  ): Promise<AiRecruiterRunItem>;

  getRunItem(organizationId: string, itemId: string): Promise<AiRecruiterRunItem | null>;

  listRunItems(organizationId: string, runId: string): Promise<AiRecruiterRunItem[]>;

  saveReply(
    organizationId: string,
    input: {
      outreachMessageId: string;
      runItemId?: string | null;
      classification: ReplyClassification;
      replySubject?: string | null;
      replySnippet?: string | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<void>;
}

export type { AiRecruiterEngineContext, AiRecruiterSearchPlan };
