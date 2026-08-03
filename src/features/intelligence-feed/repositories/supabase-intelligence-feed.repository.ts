import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  IntelligenceFeedCategory,
  IntelligenceFeedItem,
} from "@/features/intelligence-feed/domain/feed.types";
import {
  IntelligenceFeedRepositoryError,
  shouldFetchCategory,
  type FetchFeedBatchOptions,
  type IntelligenceFeedRepository,
} from "@/features/intelligence-feed/repositories/intelligence-feed.repository";
import type { Database } from "@/types/database";

const DEFAULT_SINCE_DAYS = 30;

function defaultSince(): string {
  const date = new Date();
  date.setDate(date.getDate() - DEFAULT_SINCE_DAYS);
  return date.toISOString();
}

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

function applyBefore<T extends { lt: (column: string, value: string) => T }>(
  query: T,
  before: string | null,
  column: string,
): T {
  if (before) {
    return query.lt(column, before);
  }
  return query;
}

export class SupabaseIntelligenceFeedRepository implements IntelligenceFeedRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async fetchBatch(options: FetchFeedBatchOptions): Promise<IntelligenceFeedItem[]> {
    const since = options.since ?? defaultSince();
    const limit = options.fetchLimit;
    const items: IntelligenceFeedItem[] = [];

    const tasks: Promise<void>[] = [];

    if (shouldFetchCategory(options.categories, "new_company")) {
      tasks.push(this.fetchNewCompanies(options, since, limit, items));
    }
    if (shouldFetchCategory(options.categories, "new_vacancy")) {
      tasks.push(this.fetchNewVacancies(options, since, limit, items));
    }
    if (shouldFetchCategory(options.categories, "new_recruiter")) {
      tasks.push(this.fetchSignals(options, since, limit, "new_recruiter", "new_recruiter", items));
    }
    if (shouldFetchCategory(options.categories, "new_hr_manager")) {
      tasks.push(this.fetchSignals(options, since, limit, "new_hr_manager", "new_hr_manager", items));
    }
    if (shouldFetchCategory(options.categories, "new_location")) {
      tasks.push(this.fetchSignals(options, since, limit, "new_location", "new_location", items));
    }
    if (shouldFetchCategory(options.categories, "score_change")) {
      tasks.push(this.fetchScoreChanges(options, since, limit, items));
    }
    if (shouldFetchCategory(options.categories, "ai_analysis")) {
      tasks.push(this.fetchAiAnalyses(options, since, limit, items));
    }
    if (shouldFetchCategory(options.categories, "opportunity")) {
      tasks.push(this.fetchOpportunities(options, since, limit, items));
    }

    await Promise.all(tasks);

    return items;
  }

  async getWatermark(organizationId: string): Promise<string> {
    const [companies, vacancies, signals, scores, summaries] = await Promise.all([
      this.client
        .from("companies")
        .select("created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("vacancies")
        .select("created_at")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("hiring_signals")
        .select("observed_at")
        .eq("organization_id", organizationId)
        .order("observed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("company_scores")
        .select("computed_at")
        .eq("organization_id", organizationId)
        .order("computed_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.client
        .from("ai_summaries")
        .select("generated_at")
        .eq("organization_id", organizationId)
        .order("generated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    return [
      companies.data?.created_at ?? "0",
      vacancies.data?.created_at ?? "0",
      signals.data?.observed_at ?? "0",
      scores.data?.computed_at ?? "0",
      summaries.data?.generated_at ?? "0",
    ].join("|");
  }

  private async fetchNewCompanies(
    options: FetchFeedBatchOptions,
    since: string,
    limit: number,
    items: IntelligenceFeedItem[],
  ) {
    let query = this.client
      .from("companies")
      .select("id, name, city, sector, priority, lead_score, created_at")
      .eq("organization_id", options.organizationId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    query = applyBefore(query, options.before, "created_at");

    const { data, error } = await query;
    if (error) throw new IntelligenceFeedRepositoryError(error.message);

    for (const row of data ?? []) {
      const occurredAt = row.created_at as string;
      items.push({
        id: `new_company:${row.id as string}`,
        category: "new_company",
        title: row.name as string,
        subtitle: [row.sector, row.city].filter(Boolean).join(" · ") || null,
        description: "Nieuw bedrijf toegevoegd aan HireFlow",
        companyId: row.id as string,
        companyName: row.name as string,
        occurredAt,
        priority: (row.priority as string | null) ?? null,
        score: (row.lead_score as number | null) ?? null,
        scoreDelta: null,
        href: `/companies/${row.id as string}`,
        sourceUrl: null,
        isToday: isToday(occurredAt),
      });
    }
  }

  private async fetchNewVacancies(
    options: FetchFeedBatchOptions,
    since: string,
    limit: number,
    items: IntelligenceFeedItem[],
  ) {
    let query = this.client
      .from("vacancies")
      .select("id, title, company_id, location, status, source_url, created_at, companies(name)")
      .eq("organization_id", options.organizationId)
      .gte("created_at", since)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(limit);

    query = applyBefore(query, options.before, "created_at");

    const { data, error } = await query;
    if (error) throw new IntelligenceFeedRepositoryError(error.message);

    for (const row of data ?? []) {
      const occurredAt = row.created_at as string;
      const company = row.companies as { name?: string } | null;
      const companyId = row.company_id as string;

      items.push({
        id: `new_vacancy:${row.id as string}`,
        category: "new_vacancy",
        title: row.title as string,
        subtitle: company?.name ?? "Onbekend bedrijf",
        description: row.location ? `Locatie: ${row.location as string}` : "Nieuwe vacature gedetecteerd",
        companyId,
        companyName: company?.name ?? null,
        occurredAt,
        priority: null,
        score: null,
        scoreDelta: null,
        href: `/vacancies/${row.id as string}`,
        sourceUrl: (row.source_url as string | null) ?? null,
        isToday: isToday(occurredAt),
      });
    }
  }

  private async fetchSignals(
    options: FetchFeedBatchOptions,
    since: string,
    limit: number,
    signalType: "new_recruiter" | "new_hr_manager" | "new_location",
    feedCategory: IntelligenceFeedCategory,
    items: IntelligenceFeedItem[],
  ) {
    let query = this.client
      .from("hiring_signals")
      .select("id, company_id, title, description, source_url, observed_at, companies(name, priority, lead_score)")
      .eq("organization_id", options.organizationId)
      .eq("signal_type", signalType)
      .gte("observed_at", since)
      .not("company_id", "is", null)
      .order("observed_at", { ascending: false })
      .limit(limit);

    query = applyBefore(query, options.before, "observed_at");

    const { data, error } = await query;
    if (error) throw new IntelligenceFeedRepositoryError(error.message);

    const labels: Record<string, string> = {
      new_recruiter: "Nieuwe recruiter gedetecteerd",
      new_hr_manager: "Nieuwe HR manager gedetecteerd",
      new_location: "Nieuwe vestiging gedetecteerd",
    };

    for (const row of data ?? []) {
      const occurredAt = row.observed_at as string;
      const company = row.companies as {
        name?: string;
        priority?: string | null;
        lead_score?: number | null;
      } | null;
      const companyId = row.company_id as string;

      items.push({
        id: `${feedCategory}:${row.id as string}`,
        category: feedCategory,
        title: (row.title as string | null) ?? labels[signalType] ?? signalType,
        subtitle: company?.name ?? "Onbekend bedrijf",
        description: (row.description as string | null) ?? labels[signalType] ?? null,
        companyId,
        companyName: company?.name ?? null,
        occurredAt,
        priority: company?.priority ?? null,
        score: company?.lead_score ?? null,
        scoreDelta: null,
        href: `/companies/${companyId}`,
        sourceUrl: (row.source_url as string | null) ?? null,
        isToday: isToday(occurredAt),
      });
    }
  }

  private async fetchScoreChanges(
    options: FetchFeedBatchOptions,
    since: string,
    limit: number,
    items: IntelligenceFeedItem[],
  ) {
    let query = this.client
      .from("intelligence_notifications")
      .select(
        "id, company_id, title, message, notification_type, payload, created_at, companies(name, priority, lead_score)",
      )
      .eq("organization_id", options.organizationId)
      .in("notification_type", ["score_increased", "score_decreased", "priority_changed"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(limit);

    query = applyBefore(query, options.before, "created_at");

    const { data, error } = await query;
    if (error) throw new IntelligenceFeedRepositoryError(error.message);

    for (const row of data ?? []) {
      const occurredAt = row.created_at as string;
      const company = row.companies as {
        name?: string;
        priority?: string | null;
        lead_score?: number | null;
      } | null;
      const companyId = row.company_id as string;
      const payload = (row.payload ?? {}) as {
        previousScore?: number;
        newScore?: number;
        score?: number;
      };

      const previousScore = payload.previousScore ?? null;
      const newScore = payload.newScore ?? payload.score ?? company?.lead_score ?? null;
      const delta =
        previousScore !== null && newScore !== null ? newScore - previousScore : null;

      items.push({
        id: `score_change:${row.id as string}`,
        category: "score_change",
        title: row.title as string,
        subtitle: company?.name ?? "Onbekend bedrijf",
        description: row.message as string,
        companyId,
        companyName: company?.name ?? null,
        occurredAt,
        priority: company?.priority ?? null,
        score: newScore,
        scoreDelta: delta,
        href: `/companies/${companyId}`,
        sourceUrl: null,
        isToday: isToday(occurredAt),
      });
    }
  }

  private async fetchAiAnalyses(
    options: FetchFeedBatchOptions,
    since: string,
    limit: number,
    items: IntelligenceFeedItem[],
  ) {
    let query = this.client
      .from("ai_summaries")
      .select("id, company_id, content, summary_type, generated_at, companies(name, priority, lead_score)")
      .eq("organization_id", options.organizationId)
      .eq("summary_type", "hiring_analysis")
      .gte("generated_at", since)
      .order("generated_at", { ascending: false })
      .limit(limit);

    query = applyBefore(query, options.before, "generated_at");

    const { data, error } = await query;
    if (error) throw new IntelligenceFeedRepositoryError(error.message);

    for (const row of data ?? []) {
      const occurredAt = row.generated_at as string;
      const company = row.companies as {
        name?: string;
        priority?: string | null;
        lead_score?: number | null;
      } | null;
      const companyId = row.company_id as string;
      const content = (row.content as string).slice(0, 160);

      items.push({
        id: `ai_analysis:${row.id as string}`,
        category: "ai_analysis",
        title: "Nieuwe AI Company Analysis",
        subtitle: company?.name ?? "Onbekend bedrijf",
        description: content,
        companyId,
        companyName: company?.name ?? null,
        occurredAt,
        priority: company?.priority ?? null,
        score: company?.lead_score ?? null,
        scoreDelta: null,
        href: `/companies/${companyId}`,
        sourceUrl: null,
        isToday: isToday(occurredAt),
      });
    }
  }

  private async fetchOpportunities(
    options: FetchFeedBatchOptions,
    since: string,
    limit: number,
    items: IntelligenceFeedItem[],
  ) {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const activitySince = weekAgo.toISOString();
    const effectiveSince = since > activitySince ? since : activitySince;

    let query = this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", options.organizationId)
      .in("current_priority", ["A", "B"])
      .gte("current_score", 60)
      .gte("last_signal_at", effectiveSince)
      .order("last_signal_at", { ascending: false })
      .limit(limit);

    query = applyBefore(query, options.before, "last_signal_at");

    const { data, error } = await query;
    if (error) throw new IntelligenceFeedRepositoryError(error.message);

    for (const row of data ?? []) {
      const occurredAt = (row.last_signal_at as string) ?? new Date().toISOString();
      const outreach = row.outreach_status ?? "none";

      if (outreach === "sent") continue;

      items.push({
        id: `opportunity:${row.id as string}:${occurredAt}`,
        category: "opportunity",
        title: `Nieuwe kans — Priority ${row.current_priority ?? "?"}`,
        subtitle: row.name as string,
        description: `Score ${row.current_score ?? "—"} · Hiring intensity ${row.hiring_intensity ?? 0} · Outreach: ${outreach}`,
        companyId: row.id as string,
        companyName: row.name as string,
        occurredAt,
        priority: row.current_priority as string | null,
        score: row.current_score as number | null,
        scoreDelta: null,
        href: `/companies/${row.id as string}`,
        sourceUrl: null,
        isToday: isToday(occurredAt),
      });
    }
  }
}
