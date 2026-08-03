import type { SupabaseClient } from "@supabase/supabase-js";

import {
  HiringSignalsTimelineRepositoryError,
  type FindSignalsOptions,
  type HiringSignalsTimelineRepository,
} from "@/features/hiring-signals-timeline/repositories/hiring-signals-timeline.repository";
import type { Database } from "@/types/database";
import type { CompanyScore, HiringSignal } from "@/types/hiring-intelligence";

const DEFAULT_SIGNAL_LIMIT = 120;
const DEFAULT_SCORE_LIMIT = 24;

export class SupabaseHiringSignalsTimelineRepository implements HiringSignalsTimelineRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async findSignalsByCompany(
    organizationId: string,
    companyId: string,
    options: FindSignalsOptions = {},
  ): Promise<HiringSignal[]> {
    const limit = options.limit ?? DEFAULT_SIGNAL_LIMIT;

    let query = this.client
      .from("hiring_signals")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .order("observed_at", { ascending: false })
      .limit(limit);

    if (options.signalTypes && options.signalTypes.length > 0) {
      query = query.in("signal_type", options.signalTypes);
    }

    const { data, error } = await query;

    if (error) {
      throw new HiringSignalsTimelineRepositoryError("Hiring signals laden mislukt.");
    }

    return (data ?? []) as HiringSignal[];
  }

  async findScoreHistory(
    organizationId: string,
    companyId: string,
    limit = DEFAULT_SCORE_LIMIT,
  ): Promise<CompanyScore[]> {
    const { data, error } = await this.client
      .from("company_scores")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("company_id", companyId)
      .order("computed_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw new HiringSignalsTimelineRepositoryError("Score historie laden mislukt.");
    }

    return (data ?? []) as CompanyScore[];
  }

  async getTimelineWatermark(organizationId: string, companyId: string): Promise<string> {
    const [signalsResult, scoresResult] = await Promise.all([
      this.client
        .from("hiring_signals")
        .select("updated_at")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("company_scores")
        .select("computed_at")
        .eq("organization_id", organizationId)
        .eq("company_id", companyId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const signalUpdatedAt = signalsResult.data?.updated_at ?? "0";
    const scoreComputedAt = scoresResult.data?.computed_at ?? "0";

    return `${signalUpdatedAt}|${scoreComputedAt}`;
  }
}
