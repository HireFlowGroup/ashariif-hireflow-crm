import type { SupabaseClient } from "@supabase/supabase-js";

import { isFeatureEnabled } from "@/platform/config/feature-flags";
import { platformLogger } from "@/platform/observability/logger";
import { toolExecutionCounter } from "@/platform/observability/metrics";
import type { Database } from "@/types/database";

export type AiToolLogInput = {
  organizationId: string;
  userId: string;
  conversationId?: string | null;
  toolName: string;
  toolInput: unknown;
  toolOutput?: unknown;
  success: boolean;
  durationMs: number;
  errorMessage?: string | null;
  requestId?: string | null;
};

export async function persistAiToolLog(
  client: SupabaseClient<Database>,
  input: AiToolLogInput,
): Promise<void> {
  if (!isFeatureEnabled("ai_audit_logging")) return;

  try {
    const { error } = await client.from("ai_tool_logs").insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      tool_name: input.toolName,
      tool_input: input.toolInput as Record<string, unknown>,
      tool_output: (input.toolOutput ?? null) as Record<string, unknown> | null,
      success: input.success,
      duration_ms: input.durationMs,
      error_message: input.errorMessage ?? null,
      request_id: input.requestId ?? null,
    });

    if (error) {
      platformLogger.warn("ai_tool_log.persist_failed", { message: error.message });
    }
  } catch (error) {
    platformLogger.warn("ai_tool_log.persist_error", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }

  toolExecutionCounter.inc({
    tool: input.toolName,
    success: String(input.success),
  });
}
