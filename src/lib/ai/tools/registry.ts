import { z } from "zod";
import { createCompanyTool } from "@/lib/ai/tools/companies/create-company";
import { getCurrentTimeTool } from "@/lib/ai/tools/system/get-current-time";
import type { RegisteredTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";
import { zodObjectToJsonSchema } from "@/lib/ai/tools/schemas";
import type { FunctionTool } from "openai/resources/responses/responses";

const toolRegistry = new Map<string, RegisteredTool>();

function registerTool(tool: RegisteredTool): void {
  if (toolRegistry.has(tool.name)) {
    throw new Error(`Tool "${tool.name}" is already registered.`);
  }

  toolRegistry.set(tool.name, tool);
}

function registerBuiltInTools(): void {
  registerTool(getCurrentTimeTool);
  registerTool(createCompanyTool);
}

registerBuiltInTools();

export function getRegisteredTools(): RegisteredTool[] {
  return [...toolRegistry.values()];
}

export function getToolByName(name: string): RegisteredTool | undefined {
  return toolRegistry.get(name);
}

export function getOpenAIToolDefinitions(): FunctionTool[] {
  return getRegisteredTools().map((tool) => toOpenAIFunctionTool(tool));
}

function toOpenAIFunctionTool(tool: RegisteredTool): FunctionTool {
  const parameters =
    tool.parameters instanceof z.ZodObject
      ? zodObjectToJsonSchema(tool.parameters)
      : {
          type: "object" as const,
          properties: {},
          additionalProperties: false as const,
        };

  return {
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters,
    strict: tool.strict ?? true,
  };
}

export type { ToolExecutionContext, ToolResult };
