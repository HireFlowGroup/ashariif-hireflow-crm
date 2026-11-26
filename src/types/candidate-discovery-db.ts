type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CandidateDiscoveryRunRow = {
  id: string;
  organization_id: string;
  vacancy_id: string;
  created_by: string;
  status: "pending" | "running" | "completed" | "failed" | "partial";
  queries: Json;
  query_plan: Json;
  search_attempts: Json;
  provider_meta: Json;
  proposal_count: number;
  below_threshold_count: number;
  ineligible_count: number;
  duplicate_url_count: number;
  provider_failures: number;
  min_match_score_used: number;
  error_code: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  retention_expires_at: string;
  created_at: string;
  updated_at: string;
};

export type CandidateDiscoveryProposalRow = {
  id: string;
  organization_id: string;
  vacancy_id: string;
  run_id: string;
  rank: number;
  linkedin_url: string;
  linkedin_profile_slug: string | null;
  first_name: string;
  last_name: string;
  candidate_current_role: string | null;
  location: string | null;
  summary: string | null;
  skills: Json;
  experience_years: number | null;
  unknown_fields: Json;
  source_provider: string | null;
  source_query: string | null;
  serp_title: string | null;
  serp_snippet: string | null;
  match_score: number;
  match_breakdown: Json;
  match_strong_points: Json;
  match_risks: Json;
  match_missing_info: Json;
  match_rationale: Json;
  approval_status: "proposed" | "approved" | "rejected" | "saved";
  saved_candidate_id: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};