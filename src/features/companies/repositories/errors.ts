import type { PostgrestError } from "@supabase/supabase-js";

export class CompaniesRepositoryError extends Error {
  readonly supabaseCode?: string;
  readonly supabaseDetails?: string;

  constructor(message: string, error?: PostgrestError | null) {
    super(message);
    this.name = "CompaniesRepositoryError";
    this.supabaseCode = error?.code;
    this.supabaseDetails = error?.details ?? error?.message;
  }
}
