/** Escapes user input for safe use inside PostgREST ilike patterns. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/[%_\\]/g, "\\$&");
}
