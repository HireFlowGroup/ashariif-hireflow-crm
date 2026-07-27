import type { AiConversationSummary, AiMessage } from "@/types/ai";

type ApiErrorPayload = {
  error?: string;
};

async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchConversations(): Promise<AiConversationSummary[]> {
  const response = await fetch("/api/ai/conversations");

  if (!response.ok) {
    throw new Error(await readApiError(response, "Gesprekken ophalen mislukt."));
  }

  const payload = (await response.json()) as { conversations: AiConversationSummary[] };
  return payload.conversations ?? [];
}

export async function createConversation(title?: string): Promise<AiConversationSummary> {
  const response = await fetch("/api/ai/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(title ? { title } : {}),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response, "Gesprek aanmaken mislukt."));
  }

  const payload = (await response.json()) as { conversation: AiConversationSummary };
  return payload.conversation;
}

export async function fetchConversationMessages(
  conversationId: string,
): Promise<AiMessage[]> {
  const response = await fetch(`/api/ai/conversations/${conversationId}/messages`);

  if (!response.ok) {
    throw new Error(await readApiError(response, "Berichten ophalen mislukt."));
  }

  const payload = (await response.json()) as { messages: AiMessage[] };
  return payload.messages ?? [];
}

export function readConversationIdFromResponse(response: Response): string | null {
  return response.headers.get("X-Conversation-Id");
}
