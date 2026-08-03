/**
 * HireFlow AI — Recruitment Intelligence Platform
 * Database-aligned types for hiring signals and related entities.
 */

export type {
  HiringSignalType,
  HiringSignalProviderId,
  IncomingHiringSignal,
  CompanyHint,
  HIRING_SIGNAL_TYPES,
} from "@/features/hiring-intelligence/domain/signal-types";

export type HiringSignalProvider =
  | "brave_search"
  | "google_maps"
  | "google_cse"
  | "serpapi"
  | "bing_search"
  | "firecrawl"
  | "indeed"
  | "werkenbij"
  | "linkedin"
  | "nationale_vacaturebank"
  | "native_crawler"
  | "http_fetch"
  | "playwright"
  | "manual"
  | "legacy";

export type HiringSignalStatus =
  | "pending"
  | "processing"
  | "processed"
  | "merged"
  | "duplicate"
  | "rejected"
  | "failed";

export type HiringSignalExtractedFields = {
  name?: string;
  website?: string;
  domain?: string;
  linkedin_url?: string;
  email?: string;
  general_email?: string;
  hr_email?: string;
  phone?: string;
  sector?: string;
  city?: string;
  region?: string;
  province?: string;
  country?: string;
  employee_count_min?: number;
  employee_count_max?: number;
  careers_url?: string;
  vacancy_page_url?: string;
  kvk_number?: string;
  vacancy_title?: string;
  source?: string;
  description?: string;
};

/** Persisted hiring signal row. */
export type HiringSignal = {
  id: string;
  organization_id: string;
  company_id: string | null;
  job_id: string | null;
  provider: HiringSignalProvider;
  signal_type: import("@/features/hiring-intelligence/domain/signal-types").HiringSignalType;
  status: HiringSignalStatus;
  external_id: string | null;
  source_url: string | null;
  fingerprint: string;
  title: string | null;
  description: string | null;
  confidence: number | null;
  importance: number;
  ai_relevance: number;
  source: string | null;
  payload: Record<string, unknown>;
  extracted_fields: HiringSignalExtractedFields;
  observed_at: string;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyScorePriority = "A" | "B" | "C" | "D";

export type CompanyScoreBreakdown = {
  sectorMatch?: number;
  regionMatch?: number;
  companySize?: number;
  activeVacancies?: number;
  relevantVacancies?: number;
  contactCompleteness?: number;
  sourceQuality?: number;
  signalVolume?: number;
  hiringIntensity?: number;
  exclusionPenalty?: number;
};

export type CompanyScore = {
  id: string;
  organization_id: string;
  company_id: string;
  score: number;
  priority: CompanyScorePriority | null;
  score_reason: string | null;
  score_breakdown: CompanyScoreBreakdown;
  model_version: string;
  signal_count: number;
  contributing_signal_ids: string[];
  computed_at: string;
  is_current: boolean;
  created_at: string;
};

export type AiSummaryType =
  | "recruitment_brief"
  | "classification"
  | "outreach_angle"
  | "hiring_analysis";

export type AiSummary = {
  id: string;
  organization_id: string;
  company_id: string;
  summary_type: AiSummaryType;
  content: string;
  model: string | null;
  model_version: string | null;
  metadata: Record<string, unknown>;
  generated_at: string;
  is_current: boolean;
  created_at: string;
};

export type OutreachStatus =
  | "draft"
  | "review"
  | "approved"
  | "sent"
  | "cancelled"
  | "blocked"
  | "queued";

export type Outreach = {
  id: string;
  organization_id: string;
  company_id: string;
  contact_id: string | null;
  user_id: string;
  ai_summary_id: string | null;
  hiring_signal_id: string | null;
  status: OutreachStatus;
  suggested_contact_role: string | null;
  outreach_angle: string | null;
  message_subject: string | null;
  message_body: string | null;
  review_required: boolean;
  scheduled_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyIntelligence = {
  id: string;
  organization_id: string;
  name: string;
  status: string;
  city: string | null;
  sector: string | null;
  website: string | null;
  domain: string | null;
  linkedin_url: string | null;
  hiring_intensity: number;
  signal_count: number;
  last_signal_at: string | null;
  current_score: number | null;
  current_priority: CompanyScorePriority | null;
  current_score_reason: string | null;
  current_ai_summary: string | null;
  outreach_status: string | null;
  created_at: string;
  updated_at: string;
};

export type IntelligenceScanRun = {
  id: string;
  organization_id: string;
  triggered_by: string;
  status: string;
  companies_total: number;
  companies_processed: number;
  signals_created: number;
  signals_updated: number;
  notifications_created: number;
  errors_count: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IntelligenceQueueJob = {
  id: string;
  run_id: string;
  organization_id: string;
  company_id: string;
  status: string;
  attempts: number;
  max_attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  scheduled_at: string;
  completed_at: string | null;
  result: Record<string, unknown>;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type IntelligenceNotification = {
  id: string;
  organization_id: string;
  company_id: string;
  scan_run_id: string | null;
  queue_job_id: string | null;
  notification_type: string;
  title: string;
  message: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

export type RecruitmentKnowledgeChunkRow = {
  id: string;
  organization_id: string;
  entity_type: "company" | "vacancy" | "hiring_signal" | "ai_summary";
  entity_id: string;
  title: string | null;
  content: string;
  embedding: string | null;
  metadata: Record<string, unknown>;
  content_hash: string;
  created_at: string;
  updated_at: string;
};

export type OutreachGenerationRow = {
  id: string;
  organization_id: string;
  company_id: string;
  user_id: string;
  writing_style: "formal" | "friendly" | "direct" | "consultative";
  contact_id: string | null;
  contact_name: string | null;
  primary_signal_id: string | null;
  content: Record<string, unknown>;
  referenced_signal_ids: string[];
  model: string | null;
  model_version: string;
  is_current: boolean;
  generated_at: string;
  created_at: string;
};

export type OutreachIntelligenceRow = {
  id: string;
  organization_id: string;
  company_id: string;
  outreach_id: string | null;
  recommended_contact_id: string | null;
  recommended_contact_name: string | null;
  recommended_contact_role: string | null;
  contact_score: number;
  contact_reason: string | null;
  recommended_channel: "email" | "linkedin" | "phone";
  channel_score_email: number;
  channel_score_linkedin: number;
  channel_score_phone: number;
  channel_reason: string | null;
  recommended_moment_at: string | null;
  recommended_moment_label: string | null;
  timing_reason: string | null;
  outreach_score: number;
  response_probability: number;
  score_breakdown: Record<string, unknown>;
  draft_subject: string | null;
  draft_body: string | null;
  follow_up_subject: string | null;
  follow_up_body: string | null;
  follow_up_scheduled_at: string | null;
  hiring_signal_id: string | null;
  ai_summary_id: string | null;
  model: string | null;
  is_current: boolean;
  computed_at: string;
  created_at: string;
  updated_at: string;
};
