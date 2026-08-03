export type TimestampFields = {
  created_at: string;
  updated_at: string;
};

export type Company = {
  id: string;
  organization_id?: string;
  owner_id?: string | null;
  user_id?: string | null;
  name: string;
  industry?: string | null;
  sector?: string | null;
  website?: string | null;
  domain?: string | null;
  linkedin_url?: string | null;
  email?: string | null;
  phone?: string | null;
  region?: string | null;
  province?: string | null;
  country?: string | null;
  employee_count_min?: number | null;
  employee_count_max?: number | null;
  source?: string | null;
  source_url?: string | null;
  confidence?: number | null;
  company_type?: string | null;
  company_confidence?: number | null;
  discovery_reason?: string | null;
  discovery_provider?: string | null;
  /** @deprecated Use company_scores table */
  lead_score?: number | null;
  /** @deprecated Use company_scores table */
  priority?: "A" | "B" | "C" | "D" | null;
  /** @deprecated Use company_scores table */
  score_reason?: string | null;
  /** @deprecated Use company_scores table */
  score_breakdown?: Record<string, number> | null;
  /** @deprecated Derive from vacancies / hiring_signals */
  vacancy_count?: number | null;
  /** @deprecated Use hiring_signals table */
  hiring_signals?: Array<{ type: string; description: string; source: string; confidence: number }> | null;
  last_verified_at?: string | null;
  outreach_status?: string | null;
  careers_url?: string | null;
  vacancy_page_url?: string | null;
  general_email?: string | null;
  hr_email?: string | null;
  kvk_number?: string | null;
  /** @deprecated Use ai_summaries table */
  ai_summary?: string | null;
  last_signal_at?: string | null;
  signal_count?: number | null;
  hiring_intensity?: number | null;
  current_score_id?: string | null;
  current_summary_id?: string | null;
  notes?: string | null;
  status: "active" | "inactive" | "prospect";
  city?: string | null;
  created_at: string;
  updated_at?: string;
};

export type Contact = TimestampFields & {
  id: string;
  organization_id: string;
  company_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  job_title: string | null;
  linkedin_url?: string | null;
  source?: string | null;
  source_provider?: string | null;
  external_id?: string | null;
  hiring_signal_id?: string | null;
  confidence?: number | null;
  last_verified?: string | null;
};

export type Candidate = TimestampFields & {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: "new" | "screening" | "interview" | "offer" | "hired" | "rejected";
};

export type Vacancy = TimestampFields & {
  id: string;
  organization_id: string;
  company_id: string;
  owner_id: string | null;
  title: string;
  description: string | null;
  location: string | null;
  employment_type: "full_time" | "part_time" | "contract" | "temporary";
  salary_min: number | null;
  salary_max: number | null;
  status: "draft" | "open" | "on_hold" | "closed";
  requirements: string | null;
  hiring_signal_id?: string | null;
  source?: string | null;
  source_url?: string | null;
  detected_at?: string | null;
  is_relevant?: boolean | null;
  external_id?: string | null;
};

export type PipelineStage =
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type PipelineEntry = TimestampFields & {
  id: string;
  organization_id: string;
  vacancy_id: string;
  candidate_id: string;
  stage: PipelineStage;
  position: number;
};

export type Task = TimestampFields & {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  due_at: string | null;
  status: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high" | "urgent";
  assignee_id: string | null;
  related_type: "company" | "contact" | "candidate" | "vacancy" | "hiring_signal" | "outreach" | null;
  related_id: string | null;
};

export type Organization = TimestampFields & {
  id: string;
  name: string;
  slug: string;
};

export type Profile = TimestampFields & {
  id: string;
  organization_id: string;
  full_name: string | null;
  avatar_url: string | null;
  role: "owner" | "admin" | "recruiter";
};
