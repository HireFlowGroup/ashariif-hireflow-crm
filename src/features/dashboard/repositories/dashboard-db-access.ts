export function isRecoverableSupabaseAccessError(error: unknown): boolean {
  if (!error) return false;
  const code = typeof error === "object" ? String((error as { code?: string }).code ?? "") : "";
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object"
        ? String((error as { message?: string }).message ?? "")
        : String(error);
  const fingerprint = `${code} ${message} ${JSON.stringify(error)}`;
  return (
    code === "42501"
    || code === "PGRST205"
    || code === "PGRST116"
    || /permission denied|could not find the table|schema cache/i.test(fingerprint)
  );
}

export function throwUnlessRecoverableSupabaseError(error: unknown): void {
  if (!error) return;
  if (isRecoverableSupabaseAccessError(error)) return;
  throw error;
}