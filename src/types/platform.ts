import type { AiConversation, AiMessage } from "@/types/ai";

export type AiToolLog = {
  id: string;
  organization_id: string;
  user_id: string;
  conversation_id: string | null;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_output: Record<string, unknown> | null;
  success: boolean;
  duration_ms: number;
  error_message: string | null;
  request_id: string | null;
  created_at: string;
};

export type PlatformEvent = {
  id: string;
  organization_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Record<string, unknown>;
  version: number;
  occurred_at: string;
  processed_at: string | null;
  created_at: string;
};

export type OrganizationProviderConfig = {
  id: string;
  organization_id: string;
  provider_id: string;
  enabled: boolean;
  encrypted_payload: string;
  secret_fingerprint: string;
  masked_preview: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationProviderHealth = {
  id: string;
  organization_id: string;
  provider_id: string;
  status: string;
  health_score: number;
  requests_today: number;
  success_rate: number;
  avg_response_ms: number;
  quota_remaining: number | null;
  last_error: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  updated_at: string;
};
