export function isRecoverableSupabaseAccessError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  const message = String((error as { message?: string }).message ?? "");
  return (
    code === "42501"
    || code === "PGRST205"
    || code === "PGRST116"
    || /permission denied|could not find the table|schema cache/i.test(message)
  );
}

export function throwUnlessRecoverableSupabaseError(error: unknown): void {
  if (!error) return;
  if (isRecoverableSupabaseAccessError(error)) return;
  throw error;
}