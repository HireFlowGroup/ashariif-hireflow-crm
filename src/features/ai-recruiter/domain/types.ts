import { z } from "zod";

export const aiRecruiterRunStatusSchema = z.enum([
  "draft",
  "queued",
  "discovering",
  "enriching",
  "scoring",
  "finding_contacts",
  "drafting",
  "awaiting_approval",
  "sending",
  "completed",
  "partially_completed",
  "failed",
  "cancelled",
]);

export type AiRecruiterRunStatus = z.infer<typeof aiRecruiterRunStatusSchema>;

export const aiRecruiterRunItemStageSchema = z.enum([
  "discovered",
  "validated",
  "enriched",
  "scored",
  "contact_found",
  "general_mailbox_found",
  "blocked_missing_contact",
  "contact_lookup_failed",
  "draft_created",
  "approved",
  "sent",
  "rejected",
  "skipped",
]);

export type AiRecruiterRunItemStage = z.infer<typeof aiRecruiterRunItemStageSchema>;

export const aiRecruiterPipelineStepIdSchema = z.enum([
  "discovery",
  "crawler",
  "vacancies",
  "hiring_signals",
  "contact_finder",
  "ai_analysis",
  "lead_score",
  "drafts",
  "approval",
  "sending",
  "follow_up",
]);

export type AiRecruiterPipelineStepId = z.infer<typeof aiRecruiterPipelineStepIdSchema>;

export const outreachModeSchema = z.enum(["draft_only", "manual_send", "automatic"]);
export const approvalModeSchema = z.enum(["manual", "automatic"]);

/** Strict search plan derived from natural language — no invented filters. */
export const aiRecruiterSearchPlanSchema = z.object({
  locations: z.array(z.string()).default([]),
  regions: z.array(z.string()).default([]),
  sectors: z.array(z.string()).default([]),
  employee_range: z
    .object({
      min: z.number().int().nullable(),
      max: z.number().int().nullable(),
    })
    .default({ min: null, max: null }),
  desired_roles: z.array(z.string()).default([]),
  vacancy_required: z.boolean().default(false),
  minimum_hiring_score: z.number().min(0).max(100).default(70),
  minimum_opportunity_score: z.number().min(0).max(100).default(70),
  maximum_companies: z.number().int().min(1).max(100).default(25),
  maximum_drafts: z.number().int().min(0).max(50).default(10),
  contact_roles: z.array(z.string()).default([
    "HR Manager",
    "Recruiter",
    "Talent Acquisition",
    "HR Business Partner",
    "Teamlead Recruitment",
    "Directeur",
  ]),
  outreach_mode: outreachModeSchema.default("draft_only"),
  approval_mode: approvalModeSchema.default("manual"),
  exclusions: z.array(z.string()).default([]),
  /** Explicit uncertainties the AI could not resolve from the prompt */
  uncertainties: z.array(z.string()).default([]),
  /** Short NL explanation of what was extracted */
  reasoning: z.string().default(""),
});

export type AiRecruiterSearchPlan = z.infer<typeof aiRecruiterSearchPlanSchema>;

export const aiRecruiterRunSettingsSchema = z.object({
  outreachMode: outreachModeSchema.default("draft_only"),
  approvalMode: approvalModeSchema.default("manual"),
  sendEnabled: z.boolean().default(false),
  dailySendLimit: z.number().int().default(10),
  companyCooldownDays: z.number().int().default(30),
});

export type AiRecruiterRunSettings = z.infer<typeof aiRecruiterRunSettingsSchema>;

export const scoreBreakdownSchema = z.object({
  companyFit: z.number().default(0),
  hiring: z.number().default(0),
  opportunity: z.number().default(0),
  contact: z.number().default(0),
  personalization: z.number().default(0),
  outreachReadiness: z.number().default(0),
  explanations: z.array(z.string()).default([]),
  opportunityWhy: z.array(z.string()).default([]),
  rolesSought: z.array(z.string()).default([]),
  urgency: z.enum(["high", "medium", "low"]).optional(),
  bestApproach: z.string().optional(),
  recruitmentPotential: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  recruitmentPotentialMotivation: z.string().optional(),
  salesScore: z.number().optional(),
  salesTier: z.enum(["HOT LEAD", "WARM LEAD", "FOLLOW", "IGNORE"]).optional(),
  salesWhy: z.array(z.string()).default([]),
  salesBreakdown: z
    .object({
      openVacancies: z.number(),
      growth: z.number(),
      recruitmentActivity: z.number(),
      companySize: z.number(),
      externalRecruiterChance: z.number(),
    })
    .optional(),
});

export type AiRecruiterScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const replyClassificationSchema = z.enum([
  "nieuwe_opdracht",
  "interesse",
  "later",
  "geen_interesse",
  "afgewezen",
  "automatisch_antwoord",
  "out_of_office",
  "spam",
  "onbekend",
]);

export type ReplyClassification = z.infer<typeof replyClassificationSchema>;

export const REPLY_CLASSIFICATION_LABELS: Record<ReplyClassification, string> = {
  nieuwe_opdracht: "Nieuwe opdracht",
  interesse: "Interesse",
  later: "Later",
  geen_interesse: "Geen interesse",
  afgewezen: "Afgewezen",
  automatisch_antwoord: "Automatisch antwoord",
  out_of_office: "Out of office",
  spam: "Spam",
  onbekend: "Onbekend",
};

export const replyAnalysisSchema = z.object({
  classification: replyClassificationSchema,
  confidence: z.number().min(0).max(1),
  signals: z.array(z.string()),
  reasoning: z.string(),
});

export type ReplyAnalysis = z.infer<typeof replyAnalysisSchema>;

export const suggestedReplySchema = z.object({
  subject: z.string().nullable(),
  bodyText: z.string().nullable(),
  shouldSend: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export type SuggestedReply = z.infer<typeof suggestedReplySchema>;

export const bdOutreachAnalysisSchema = z.object({
  whyAgency: z.string(),
  likelyPain: z.string(),
  whyHireFlow: z.string(),
  growthStage: z.string().nullable(),
  factsUsed: z.array(z.string()),
});

export type BdOutreachAnalysis = z.infer<typeof bdOutreachAnalysisSchema>;

export const outreachDraftContentSchema = z.object({
  subjectOptions: z.array(z.string()).length(3),
  recommendedSubject: z.string(),
  bodyText: z.string(),
  bodyHtml: z.string().nullable(),
  personalizationSources: z.array(z.string()),
  factualClaims: z.array(z.string()),
  warnings: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  bdAnalysis: bdOutreachAnalysisSchema.optional(),
});

export type OutreachDraftContent = z.infer<typeof outreachDraftContentSchema>;

export type AiRecruiterPipelineStep = {
  id: AiRecruiterPipelineStepId;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  processed: number;
  succeeded: number;
  skipped: number;
  errors: number;
  message: string | null;
};

export type AiRecruiterRunCounters = {
  found: number;
  validated: number;
  withVacancies: number;
  withSignals: number;
  contactFound: number;
  generalMailboxFound: number;
  blockedMissingContact: number;
  draftsCreated: number;
  approved: number;
  sent: number;
  failed: number;
  skipped: number;
  replies: number;
};

export type AiRecruiterRun = {
  id: string;
  organizationId: string;
  createdBy: string;
  name: string;
  prompt: string;
  status: AiRecruiterRunStatus;
  searchCriteria: AiRecruiterSearchPlan;
  settings: AiRecruiterRunSettings;
  counters: AiRecruiterRunCounters;
  pipelineSteps: AiRecruiterPipelineStep[];
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AiRecruiterRunItem = {
  id: string;
  organizationId: string;
  runId: string;
  companyId: string | null;
  externalCompanyData: Record<string, unknown>;
  stage: AiRecruiterRunItemStage;
  status: "pending" | "processing" | "completed" | "failed" | "skipped";
  discoveryScore: number | null;
  hiringScore: number | null;
  contactScore: number | null;
  outreachScore: number | null;
  totalScore: number | null;
  scoreBreakdown: AiRecruiterScoreBreakdown;
  rejectionReason: string | null;
  warnings: string[];
  selectedContactId: string | null;
  outreachMessageId: string | null;
  createdAt: string;
  updatedAt: string;
  companyName?: string;
  companyCity?: string | null;
  companySector?: string | null;
  contactName?: string | null;
  recipientEmail?: string | null;
  draftSubject?: string | null;
  contactJobTitle?: string | null;
  contactVerificationStatus?: string | null;
  contactSourceType?: string | null;
  contactRelevanceScore?: number | null;
  contactSelectionReason?: string | null;
  contactLinkedinUrl?: string | null;
  contactReliabilityLevel?: "high" | "medium" | "low" | null;
  contactReliabilityScore?: number | null;
  contactReliabilitySummary?: string | null;
  contactRoleLabel?: string | null;
  contactAlternatives?: Array<{
    email: string;
    recipientName: string | null;
    jobTitle: string | null;
    relevanceScore: number;
    sourceType: string;
    verificationStatus: string;
    isGeneralMailbox: boolean;
    linkedinUrl?: string | null;
    reliabilityLevel?: "high" | "medium" | "low";
    reliabilitySummary?: string;
    roleLabel?: string | null;
  }>;
  contactDiscoveryError?: string | null;
};

export type AiRecruiterEngineContext = {
  organizationId: string;
  userId: string;
};

export type CreateAiRecruiterRunInput = {
  name: string;
  prompt: string;
  searchPlan: AiRecruiterSearchPlan;
};

export type AiRecruiterStreamEvent =
  | { type: "connected"; runId: string }
  | { type: "run_status"; status: AiRecruiterRunStatus; message?: string }
  | { type: "pipeline"; steps: AiRecruiterPipelineStep[] }
  | { type: "item"; item: AiRecruiterRunItem }
  | { type: "counters"; counters: AiRecruiterRunCounters }
  | { type: "complete"; run: AiRecruiterRun }
  | { type: "error"; message: string };

export function priorityFromTotalScore(score: number): "A" | "B" | "C" | "Reject" {
  if (score >= 80) return "A";
  if (score >= 60) return "B";
  if (score >= 40) return "C";
  return "Reject";
}

export function createInitialCounters(): AiRecruiterRunCounters {
  return {
    found: 0,
    validated: 0,
    withVacancies: 0,
    withSignals: 0,
    contactFound: 0,
    generalMailboxFound: 0,
    blockedMissingContact: 0,
    draftsCreated: 0,
    approved: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    replies: 0,
  };
}

export function createInitialPipelineSteps(): AiRecruiterPipelineStep[] {
  const defs: Array<[AiRecruiterPipelineStepId, string]> = [
    ["discovery", "Discovery"],
    ["crawler", "Crawler"],
    ["vacancies", "Vacatures"],
    ["hiring_signals", "Hiring Signals"],
    ["contact_finder", "Contact Finder"],
    ["ai_analysis", "AI Analyse"],
    ["lead_score", "Leadscore"],
    ["drafts", "Concepten"],
    ["approval", "Goedkeuring"],
    ["sending", "Verzending"],
    ["follow_up", "Opvolging"],
  ];

  return defs.map(([id, label]) => ({
    id,
    label,
    status: "pending" as const,
    startedAt: null,
    completedAt: null,
    durationMs: null,
    processed: 0,
    succeeded: 0,
    skipped: 0,
    errors: 0,
    message: null,
  }));
}
