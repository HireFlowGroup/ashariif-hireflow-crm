/** Reads a plain-text streaming body from POST /api/ai/chat. */
export async function readChatStream(
  response: Response,
  onChunk: (accumulated: string) => void,
): Promise<string> {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Geen antwoordstream ontvangen van de server.");
  }

  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    accumulated += decoder.decode(value, { stream: true });
    onChunk(accumulated);
  }

  accumulated += decoder.decode();
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
