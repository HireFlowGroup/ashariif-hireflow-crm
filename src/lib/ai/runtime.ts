import type OpenAI from "openai";
import type {
  EasyInputMessage,
  ResponseFunctionToolCall,
  ResponseInputItem,
  ResponseOutputItem,
} from "openai/resources/responses/responses";
import {
  DEFAULT_MODEL,
  DEFAULT_TEMPERATURE,
  MAX_OUTPUT_TOKENS,
} from "@/lib/ai/config";
import type { ChatStreamToolEvent } from "@/lib/ai/chat/stream-events";
import { RECRUITMENT_COPILOT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { executeTool } from "@/lib/ai/tools/execute-tool";
import { getOpenAIToolDefinitions } from "@/lib/ai/tools/registry";
import type { ToolExecutionContext } from "@/lib/ai/tools/types";

const MAX_TOOL_ROUNDS = 8;

type StreamModelWithToolsParams = {
  client: OpenAI;
  input: EasyInputMessage[];
  context: ToolExecutionContext;
  onTextDelta: (delta: string) => void;
  onToolEvent?: (event: Omit<ChatStreamToolEvent, "type">) => void;
};

function isFunctionToolCall(item: ResponseOutputItem): item is ResponseFunctionToolCall {
  return item.type === "function_call";
}

function normalizeResponseInput(input: EasyInputMessage[]): ResponseInputItem[] {
  return [...input];
}

function appendResponseInput(
  current: ResponseInputItem[],
  items: ResponseOutputItem[],
): ResponseInputItem[] {
  return [...current, ...(items as ResponseInputItem[])];
}

/** Runs the Responses API with tool-calling rounds, then streams the final answer text. */
export async function streamModelResponseWithTools(
  params: StreamModelWithToolsParams,
): Promise<string> {
  const tools = getOpenAIToolDefinitions();
  let conversationInput = normalizeResponseInput(params.input);

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const preparation = await params.client.responses.create({
      model: DEFAULT_MODEL,
      instructions: RECRUITMENT_COPILOT_SYSTEM_PROMPT,
      input: conversationInput,
      tools,
      stream: false,
      temperature: DEFAULT_TEMPERATURE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });

    const toolCalls = preparation.output.filter(isFunctionToolCall);

    if (toolCalls.length > 0) {
      conversationInput = appendResponseInput(conversationInput, preparation.output);

      for (const toolCall of toolCalls) {
        const toolOutput = await executeTool(
          toolCall.name,
          toolCall.arguments,
          params.context,
        );

        try {
          const parsedOutput = JSON.parse(toolOutput) as {
            success?: boolean;
            message?: string;
          };

          params.onToolEvent?.({
            name: toolCall.name,
            success: parsedOutput.success === true,
            message:
              typeof parsedOutput.message === "string"
                ? parsedOutput.message
                : "Tool uitgevoerd.",
          });
        } catch {
          params.onToolEvent?.({
            name: toolCall.name,
            success: false,
            message: "Toolresultaat kon niet worden gelezen.",
          });
        }

        conversationInput.push({
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: toolOutput,
        });
      }

      continue;
    }

    if (preparation.output_text.trim()) {
      params.onTextDelta(preparation.output_text);
      return preparation.output_text.trim();
    }

    let accumulated = "";

    const stream = await params.client.responses.create({
      model: DEFAULT_MODEL,
      instructions: RECRUITMENT_COPILOT_SYSTEM_PROMPT,
      input: conversationInput,
      tools,
      stream: true,
      temperature: DEFAULT_TEMPERATURE,
      max_output_tokens: MAX_OUTPUT_TOKENS,
    });

    for await (const event of stream) {
      if (event.type === "response.output_text.delta" && event.delta) {
        accumulated += event.delta;
        params.onTextDelta(event.delta);
      }
    }

    return accumulated.trim();
  }

  throw new Error("Maximaal aantal tool-rondes bereikt.");
}
