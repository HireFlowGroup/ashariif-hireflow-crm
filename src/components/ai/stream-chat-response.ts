import {
  CHAT_STREAM_FORMAT_HEADER,
  CHAT_STREAM_FORMAT_NDJSON,
  parseChatStreamLine,
  type ChatStreamToolEvent,
} from "@/lib/ai/chat/stream-events";

export type ChatStreamHandlers = {
  onText: (accumulated: string) => void;
  onToolEvent?: (event: ChatStreamToolEvent) => void;
};

/** Reads a streaming body from POST /api/ai/chat (NDJSON events or legacy plain text). */
export async function readChatStream(
  response: Response,
  onChunk: (accumulated: string) => void,
  onToolEvent?: (event: ChatStreamToolEvent) => void,
): Promise<string> {
  const format = response.headers.get(CHAT_STREAM_FORMAT_HEADER);
  const useNdjson = format === CHAT_STREAM_FORMAT_NDJSON;

  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Geen antwoordstream ontvangen van de server.");
  }

  const decoder = new TextDecoder();
  let accumulated = "";
  let lineBuffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    const chunk = decoder.decode(value, { stream: true });

    if (!useNdjson) {
      accumulated += chunk;
      onChunk(accumulated);
      continue;
    }

    lineBuffer += chunk;

    let newlineIndex = lineBuffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = lineBuffer.slice(0, newlineIndex);
      lineBuffer = lineBuffer.slice(newlineIndex + 1);

      const event = parseChatStreamLine(line);

      if (event?.type === "text") {
        accumulated += event.delta;
        onChunk(accumulated);
      } else if (event?.type === "tool") {
        onToolEvent?.(event);
      } else if (event?.type === "error") {
        throw new Error(event.message);
      }

      newlineIndex = lineBuffer.indexOf("\n");
    }
  }

  const trailing = decoder.decode();

  if (!useNdjson) {
    accumulated += trailing;
    onChunk(accumulated);
    return accumulated.trim();
  }

  if (trailing) {
    lineBuffer += trailing;
  }

  if (lineBuffer.trim()) {
    const event = parseChatStreamLine(lineBuffer);

    if (event?.type === "text") {
      accumulated += event.delta;
      onChunk(accumulated);
    } else if (event?.type === "tool") {
      onToolEvent?.(event);
    } else if (event?.type === "error") {
      throw new Error(event.message);
    }
  }

  onChunk(accumulated);
  return accumulated.trim();
}

export async function parseChatErrorResponse(response: Response): Promise<string> {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error?.trim()) {
        return payload.error;
      }
    } catch {
      // Fall through to generic message.
    }
  }

  if (response.status === 401) {
    return "Je bent niet ingelogd. Log opnieuw in om de assistent te gebruiken.";
  }

  return "Er ging iets mis bij het genereren van een antwoord. Probeer het opnieuw.";
}
