/** NDJSON stream events for POST /api/ai/chat (Sprint 3.0). */

export const CHAT_STREAM_FORMAT_HEADER = "X-Chat-Stream-Format";
export const CHAT_STREAM_FORMAT_NDJSON = "ndjson-v1";

export type ChatStreamTextEvent = {
  type: "text";
  delta: string;
};

export type ChatStreamToolEvent = {
  type: "tool";
  name: string;
  success: boolean;
  message: string;
};

export type ChatStreamErrorEvent = {
  type: "error";
  message: string;
};

export type ChatStreamEvent =
  | ChatStreamTextEvent
  | ChatStreamToolEvent
  | ChatStreamErrorEvent;

export function encodeChatStreamEvent(event: ChatStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}

export function parseChatStreamLine(line: string): ChatStreamEvent | null {
  const trimmed = line.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as ChatStreamEvent;

    if (
      parsed.type === "text" &&
      typeof parsed.delta === "string"
    ) {
      return parsed;
    }

    if (
      parsed.type === "tool" &&
      typeof parsed.name === "string" &&
      typeof parsed.success === "boolean" &&
      typeof parsed.message === "string"
    ) {
      return parsed;
    }

    if (parsed.type === "error" && typeof parsed.message === "string") {
      return parsed;
    }

    return null;
  } catch {
    return null;
  }
}
