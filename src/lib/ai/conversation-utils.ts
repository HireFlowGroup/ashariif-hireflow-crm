const DEFAULT_CONVERSATION_TITLE = "Nieuw gesprek";
const MAX_TITLE_LENGTH = 80;

/** Short label for the sidebar from the first user message. */
export function deriveConversationTitle(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");

  if (!normalized) {
    return DEFAULT_CONVERSATION_TITLE;
  }

  if (normalized.length <= MAX_TITLE_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_TITLE_LENGTH - 1)}…`;
}

export function isDefaultConversationTitle(title: string): boolean {
  return title.trim() === DEFAULT_CONVERSATION_TITLE;
}
