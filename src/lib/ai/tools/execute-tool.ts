import { getToolByName } from "@/lib/ai/tools/registry";
import { parseToolArguments } from "@/lib/ai/tools/schemas";
import type { ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";
import { createClient } from "@/lib/supabase/server";
import { persistAiToolLog } from "@/platform/audit/ai-tool-log.repository";
import { tracer } from "@/platform/observability/tracing";
import { withRetry } from "@/platform/resilience/retry";
import { getServerEnv } from "@/platform/config/env";

export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolExecutionError";
  }
}

export type ExecuteToolOptions = {
  conversationId?: string | null;
  requestId?: string | null;
};

/** Validates arguments, runs a registered tool with retry + audit logging; returns JSON for OpenAI. */
export async function executeTool(
  toolName: string,
  rawArguments: string,
  context: ToolExecutionContext,
  options: ExecuteToolOptions = {},
): Promise<string> {
  const started = Date.now();

  return tracer.withSpan(
    `ai.tool.${toolName}`,
    async () => {
      const tool = getToolByName(toolName);

      if (!tool) {
        const result: ToolResult = {
          success: false,
          message: `Onbekende tool: ${toolName}`,
        };
        await audit(context, toolName, {}, result, started, options, "Onbekende tool");
        return JSON.stringify(result);
      }

      let parsedArguments: unknown;

      try {
        parsedArguments = parseToolArguments(rawArguments);
      } catch {
        const result: ToolResult = {
          success: false,
          message: "Toolargumenten zijn geen geldige JSON.",
        };
        await audit(context, toolName, rawArguments, result, started, options, result.message);
        return JSON.stringify(result);
      }

      const validated = tool.parameters.safeParse(parsedArguments);

      if (!validated.success) {
        const result: ToolResult = {
          success: false,
          message: validated.error.issues[0]?.message ?? "Ongeldige toolargumenten.",
        };
        await audit(context, toolName, parsedArguments, result, started, options, result.message);
        return JSON.stringify(result);
      }

      const input = validated.data;

      try {
        const maxRetries = getServerEnv().PLATFORM_MAX_RETRIES ?? 2;

        const result = await withRetry(
          () => tool.execute(input, context),
          { maxAttempts: maxRetries + 1 },
        );

        await audit(context, toolName, input, result, started, options);
        return JSON.stringify(result);
      } catch (error) {
        const message = error instanceof Error ? error.message : `Tool "${toolName}" mislukt.`;
        const result: ToolResult = { success: false, message };
        await audit(context, toolName, input, result, started, options, message);
        return JSON.stringify(result);
      }
    },
    { "ai.tool": toolName },
  );
}

async function audit(
  context: ToolExecutionContext,
  toolName: string,
  toolInput: unknown,
  result: ToolResult,
  started: number,
  options: ExecuteToolOptions,
  errorMessage?: string,
): Promise<void> {
  try {
    const client = await createClient();
    await persistAiToolLog(client, {
      organizationId: context.organizationId,
      userId: context.userId,
      conversationId: options.conversationId,
      toolName,
      toolInput,
      toolOutput: result,
      success: result.success === true,
      durationMs: Date.now() - started,
      errorMessage: errorMessage ?? (result.success ? null : result.message),
      requestId: options.requestId,
    });
  } catch {
    // Audit must never break tool execution
  }
}
