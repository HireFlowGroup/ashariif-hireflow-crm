import type { PostgrestError } from "@supabase/supabase-js";

export class CompanySearchJobRepositoryError extends Error {
  readonly supabaseCode?: string;
  readonly supabaseDetails?: string;

  constructor(message: string, error?: PostgrestError | null) {
    super(message);
    this.name = "CompanySearchJobRepositoryError";
    this.supabaseCode = error?.code;
    this.supabaseDetails = error?.details ?? error?.message;
  }
}
