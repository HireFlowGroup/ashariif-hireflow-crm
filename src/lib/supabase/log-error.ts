import type { PostgrestError } from "@supabase/supabase-js";

export type SupabaseLogContext = {
  operation: string;
  repository?: string;
  requestUrl?: string;
  userId?: string;
  organizationId?: string;
  responseStatus?: number;
  error: PostgrestError | null | undefined;
};

/** Logs Supabase/PostgREST errors without secrets. */
export function logSupabaseError(context: SupabaseLogContext): void {
  const { error } = context;

  if (!error) {
    return;
  }

  console.error(`[${context.operation}] Supabase-fout`, {
    repository: context.repository,
    requestUrl: context.requestUrl,
    userId: context.userId,
    organizationId: context.organizationId,
    responseStatus: context.responseStatus,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

export function toSafeSupabaseDetails(error: PostgrestError | null | undefined): string | undefined {
  if (!error?.message) {
    return undefined;
  }

  if (error.code === "42501") {
    return "Geen toegang tot deze gegevens binnen je organisatie.";
  }

  if (error.code === "23505") {
    return "Deze gegevens bestaan al.";
  }

  if (error.code === "23503") {
    return "Gerelateerde gegevens ontbreken.";
  }

  if (error.code === "PGRST116") {
    return "Record niet gevonden.";
  }

  return error.message;
}
