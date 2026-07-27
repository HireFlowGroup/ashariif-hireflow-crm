import { getToolByName } from "@/lib/ai/tools/registry";
import { parseToolArguments } from "@/lib/ai/tools/schemas";
import type { ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export class ToolExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolExecutionError";
  }
}

/** Validates arguments and runs a registered tool; returns JSON for OpenAI. */
export async function executeTool(
  toolName: string,
  rawArguments: string,
  context: ToolExecutionContext,
): Promise<string> {
  const tool = getToolByName(toolName);

  if (!tool) {
    const result: ToolResult = {
      success: false,
      message: `Onbekende tool: ${toolName}`,
    };
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
    return JSON.stringify(result);
  }

  const validated = tool.parameters.safeParse(parsedArguments);

  if (!validated.success) {
    const result: ToolResult = {
      success: false,
      message: validated.error.issues[0]?.message ?? "Ongeldige toolargumenten.",
    };
    return JSON.stringify(result);
  }

  try {
    const result = await tool.execute(validated.data, context);
    return JSON.stringify(result);
  } catch {
    const result: ToolResult = {
      success: false,
      message: `Tool "${toolName}" kon niet worden uitgevoerd.`,
    };
    return JSON.stringify(result);
  }
}
