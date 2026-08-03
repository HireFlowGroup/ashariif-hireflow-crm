import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  HiringSignalsRepository,
  UpsertHiringSignalInput,
  UpsertHiringSignalResult,
} from "@/features/hiring-intelligence/repositories/hiring-signals.repository";
import { HiringSignalsRepositoryError } from "@/features/hiring-intelligence/repositories/hiring-signals.repository";
import type { Database } from "@/types/database";
import type { HiringSignal } from "@/types/hiring-intelligence";

export class SupabaseHiringSignalsRepository implements HiringSignalsRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async upsert(input: UpsertHiringSignalInput): Promise<UpsertHiringSignalResult> {
    const { data: existing } = await this.client
      .from("hiring_signals")
      .select("id")
      .eq("organization_id", input.organizationId)
      .eq("fingerprint", input.fingerprint)
      .maybeSingle();

    const { data, error } = await this.client.rpc("upsert_hiring_signal", {
      p_organization_id: input.organizationId,
      p_company_id: input.companyId ?? input.signal.companyId ?? null,
      p_job_id: input.jobId ?? null,
      p_provider: input.signal.provider,
      p_signal_type: input.signal.type,
      p_fingerprint: input.fingerprint,
      p_title: input.signal.title,
      p_description: input.signal.description,
      p_source_url: input.signal.url,
      p_source: input.signal.source,
      p_confidence: input.signal.confidence,
      p_importance: input.signal.importance,
      p_ai_relevance: input.signal.aiRelevance,
      p_external_id: input.signal.externalId ?? null,
      p_payload: (input.signal.payload ?? {}) as never,
      p_extracted_fields: (input.signal.extractedFields ?? {}) as never,
      p_observed_at: input.signal.observedAt ?? new Date().toISOString(),
    });

    if (error || !data) {
      throw new HiringSignalsRepositoryError(
        error?.message ?? "Hiring signal kon niet worden opgeslagen.",
      );
    }

    return {
      signal: data as HiringSignal,
      created: !existing,
    };
  }

  async upsertBatch(inputs: UpsertHiringSignalInput[]): Promise<UpsertHiringSignalResult[]> {
    const results: UpsertHiringSignalResult[] = [];

    for (const input of inputs) {
      results.push(await this.upsert(input));
    }

    return results;
  }

  async findByJob(organizationId: string, jobId: string): Promise<HiringSignal[]> {
    const { data, error } = await this.client
      .from("hiring_signals")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("job_id", jobId)
      .order("observed_at", { ascending: false });

    if (error) {
      throw new HiringSignalsRepositoryError("Signals laden mislukt.");
    }

    return (data ?? []) as HiringSignal[];
  }

  async findByCompany(organizationId: string, companyId: string): Promise<HiringSignal[]> {
    const { data, error } = await this.client
      .from("hiring_signals")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .order("observed_at", { ascending: false });

    if (error) {
      throw new HiringSignalsRepositoryError("Signals laden mislukt.");
    }

    return (data ?? []) as HiringSignal[];
  }

  async linkToCompany(
    organizationId: string,
    signalId: string,
    companyId: string,
  ): Promise<void> {
    const { error } = await this.client
      .from("hiring_signals")
      .update({ company_id: companyId })
      .eq("organization_id", organizationId)
      .eq("id", signalId);

    if (error) {
      throw new HiringSignalsRepositoryError("Signal koppelen aan bedrijf mislukt.");
    }

    await this.client.rpc("apply_hiring_signal_to_company", { p_signal_id: signalId });
  }
}
