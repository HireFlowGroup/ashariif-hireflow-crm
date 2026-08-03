/** Normalize external URLs before Zod validation — invalid URLs become null. */
export function sanitizeDiscoveryUrl(value: string | null | undefined): string | null {
  if (!value || typeof value !== "string") {
    return null;
  }

  let trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed.replace(/^\/+/, "")}`;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.includes(".")) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export function discoveryUrlFallbackNote(
  rawUrl: string | null | undefined,
  existingNotes?: string | null,
): string | null {
  if (!rawUrl?.trim()) {
    return existingNotes ?? null;
  }

  const sanitized = sanitizeDiscoveryUrl(rawUrl);
  if (sanitized) {
    return existingNotes ?? null;
  }

  const note = `Bron-URL (niet gevalideerd): ${rawUrl.trim()}`;
  return existingNotes?.trim() ? `${existingNotes.trim()}\n${note}` : note;
}
