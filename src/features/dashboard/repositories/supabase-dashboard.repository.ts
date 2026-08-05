import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  DashboardAiRecommendation,
  DashboardFilters,
  DashboardKpis,
  DashboardPipelineStage,
  DashboardPrioritySlice,
  DashboardRecruiterSignal,
  DashboardSignalItem,
  DashboardSignalTrendPoint,
  DashboardSnapshot,
  DashboardTodaysIntelligence,
  DashboardVacancyItem,
  DashboardWarmLead,
  DashboardOutreachSlice,
} from "@/features/dashboard/domain/dashboard.types";
import {
  periodToStartDate,
  todayStartIso,
} from "@/features/dashboard/domain/dashboard.types";
import { loadBdDashboardMetrics } from "@/features/dashboard/repositories/bd-dashboard-metrics.loader";
import { DashboardRepositoryError } from "@/features/dashboard/repositories/dashboard.repository";
import type { DashboardRepository } from "@/features/dashboard/repositories/dashboard.repository";
import {
  OUTREACH_LABELS,
  PIPELINE_LABELS,
  PRIORITY_LABELS,
} from "@/features/dashboard/domain/dashboard-labels";
import type { Database } from "@/types/database";
import type { CompanyIntelligence } from "@/types/hiring-intelligence";

export class SupabaseDashboardRepository implements DashboardRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private async loadCompanyNames(
    organizationId: string,
    companyIds: string[],
  ): Promise<Map<string, string>> {
    const uniqueIds = [...new Set(companyIds.filter(Boolean))];
    const map = new Map<string, string>();

    if (uniqueIds.length === 0) return map;

    const { data, error } = await this.client
      .from("companies")
      .select("id, name")
      .eq("organization_id", organizationId)
      .in("id", uniqueIds);

    if (error) throw error;

    for (const row of data ?? []) {
      map.set(row.id as string, row.name as string);
    }

    return map;
  }

  async loadSnapshot(organizationId: string, filters: DashboardFilters): Promise<DashboardSnapshot> {
    const periodStart = periodToStartDate(filters.period);
    const todayStart = todayStartIso();

    try {
      const [
        kpis,
        bdMetrics,
        warmLeads,
        recentSignals,
        recentVacancies,
        recruiterSignals,
        priorityDistribution,
        pipelineStages,
        outreachDistribution,
        aiRecommendations,
        todaysIntelligence,
        signalTrend,
      ] = await Promise.all([
        this.loadKpis(organizationId, periodStart, todayStart),
        loadBdDashboardMetrics(this.client, organizationId),
        this.loadWarmLeads(organizationId, filters),
        this.loadRecentSignals(organizationId, periodStart, filters),
        this.loadRecentVacancies(organizationId, periodStart, filters),
        this.loadRecruiterSignals(organizationId, periodStart),
        this.loadPriorityDistribution(organizationId, filters),
        this.loadPipelineStages(organizationId),
        this.loadOutreachDistribution(organizationId),
        this.loadAiRecommendations(organizationId, filters),
        this.loadTodaysIntelligence(organizationId, todayStart),
        this.loadSignalTrend(organizationId, filters.period),
      ]);

      return {
        filters,
        kpis,
        bdMetrics,
        warmLeads,
        recentSignals,
        recentVacancies,
        recruiterSignals,
        priorityDistribution,
        pipelineStages,
        outreachDistribution,
        aiRecommendations,
        todaysIntelligence,
        signalTrend,
        generatedAt: new Date().toISOString(),
      };
    } catch (error) {
      throw new DashboardRepositoryError(
        error instanceof Error ? error.message : "Dashboard laden mislukt.",
      );
    }
  }

  private async loadKpis(
    organizationId: string,
    periodStart: string,
    todayStart: string,
  ): Promise<DashboardKpis> {
    const [
      signalsResult,
      vacanciesResult,
      companiesResult,
      recruitersResult,
      warmLeadsResult,
    ] = await Promise.all([
      this.client
        .from("hiring_signals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("observed_at", periodStart),
      this.client
        .from("vacancies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", periodStart),
      this.client
        .from("companies")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("created_at", periodStart)
        .neq("status", "inactive"),
      this.client
        .from("hiring_signals")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .eq("signal_type", "new_recruiter")
        .gte("observed_at", periodStart),
      this.client
        .from("companies_intelligence")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .gte("current_score", 70),
    ]);

    let notificationsToday = 0;
    let unreadNotifications = 0;
    let todaysIntelligence = 0;

    try {
      const [notificationsResult, unreadResult, todaysIntelResult] = await Promise.all([
        this.client
          .from("intelligence_notifications")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .gte("created_at", todayStart),
        this.client
          .from("intelligence_notifications")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .is("read_at", null),
        this.client
          .from("intelligence_scan_runs")
          .select("signals_created, signals_updated, notifications_created")
          .eq("organization_id", organizationId)
          .gte("created_at", todayStart)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      notificationsToday = notificationsResult.count ?? 0;
      unreadNotifications = unreadResult.count ?? 0;

      const todaysScan = todaysIntelResult.data as {
        signals_created?: number;
        signals_updated?: number;
      } | null;

      todaysIntelligence =
        (todaysScan?.signals_created ?? 0) +
        (todaysScan?.signals_updated ?? 0) +
        notificationsToday;
    } catch {
      // intelligence tables may not exist until migration is applied
    }

    return {
      newHiringSignals: signalsResult.count ?? 0,
      newVacancies: vacanciesResult.count ?? 0,
      newCompanies: companiesResult.count ?? 0,
      newRecruiters: recruitersResult.count ?? 0,
      todaysIntelligence,
      unreadNotifications,
      warmLeadsCount: warmLeadsResult.count ?? 0,
    };
  }

  private async loadWarmLeads(
    organizationId: string,
    filters: DashboardFilters,
  ): Promise<DashboardWarmLead[]> {
    let query = this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .order("current_score", { ascending: false, nullsFirst: false })
      .limit(100);

    if (filters.priority && filters.priority !== "all") {
      query = query.eq("current_priority", filters.priority);
    }

    if (filters.sector) {
      query = query.ilike("sector", `%${filters.sector}%`);
    }

    const { data, error } = await query;

    if (error) throw error;

    return ((data ?? []) as CompanyIntelligence[]).map((row) => ({
      id: row.id,
      name: row.name,
      city: row.city,
      sector: row.sector,
      score: row.current_score,
      priority: row.current_priority,
      hiringIntensity: row.hiring_intensity ?? 0,
      signalCount: row.signal_count ?? 0,
      vacancyCount: 0,
      lastSignalAt: row.last_signal_at,
      outreachStatus: row.outreach_status,
    }));
  }

  private async loadRecentSignals(
    organizationId: string,
    periodStart: string,
    _filters: DashboardFilters,
  ): Promise<DashboardSignalItem[]> {
    const { data, error } = await this.client
      .from("hiring_signals")
      .select("id, company_id, signal_type, title, source, observed_at, importance")
      .eq("organization_id", organizationId)
      .gte("observed_at", periodStart)
      .order("observed_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNames(
      organizationId,
      rows.map((row) => row.company_id as string | null).filter(Boolean) as string[],
    );

    return rows.map((row) => ({
      id: row.id as string,
      companyId: row.company_id as string | null,
      companyName: row.company_id ? companyNames.get(row.company_id as string) ?? null : null,
      signalType: row.signal_type as string,
      title: row.title as string | null,
      source: row.source as string | null,
      observedAt: row.observed_at as string,
      importance: (row.importance as number) ?? 0,
    }));
  }

  private async loadRecentVacancies(
    organizationId: string,
    periodStart: string,
    _filters: DashboardFilters,
  ): Promise<DashboardVacancyItem[]> {
    const { data, error } = await this.client
      .from("vacancies")
      .select("id, title, company_id, status, location, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) throw error;

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNames(
      organizationId,
      rows.map((row) => row.company_id as string),
    );

    return rows.map((row) => ({
      id: row.id as string,
      title: row.title as string,
      companyId: row.company_id as string,
      companyName: companyNames.get(row.company_id as string) ?? null,
      status: row.status as string,
      city: row.location as string | null,
      createdAt: row.created_at as string,
    }));
  }

  private async loadRecruiterSignals(
    organizationId: string,
    periodStart: string,
  ): Promise<DashboardRecruiterSignal[]> {
    const { data, error } = await this.client
      .from("hiring_signals")
      .select("id, company_id, title, description, observed_at, source_url")
      .eq("organization_id", organizationId)
      .in("signal_type", ["new_recruiter", "new_hr_manager"])
      .gte("observed_at", periodStart)
      .order("observed_at", { ascending: false })
      .limit(15);

    if (error) throw error;

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNames(
      organizationId,
      rows.map((row) => row.company_id as string | null).filter(Boolean) as string[],
    );

    return rows.map((row) => ({
      id: row.id as string,
      companyId: row.company_id as string | null,
      companyName: row.company_id ? companyNames.get(row.company_id as string) ?? null : null,
      title: row.title as string | null,
      description: row.description as string | null,
      observedAt: row.observed_at as string,
      sourceUrl: row.source_url as string | null,
    }));
  }

  private async loadPriorityDistribution(
    organizationId: string,
    filters: DashboardFilters,
  ): Promise<DashboardPrioritySlice[]> {
    let query = this.client
      .from("companies_intelligence")
      .select("current_priority")
      .eq("organization_id", organizationId);

    if (filters.sector) {
      query = query.ilike("sector", `%${filters.sector}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const key = (row.current_priority as string | null) ?? "unscored";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const order = ["A", "B", "C", "D", "unscored"];
    return order
      .filter((key) => counts.has(key))
      .map((key) => ({
        priority: key as DashboardPrioritySlice["priority"],
        count: counts.get(key) ?? 0,
        label: PRIORITY_LABELS[key] ?? key,
      }));
  }

  private async loadPipelineStages(organizationId: string): Promise<DashboardPipelineStage[]> {
    const { data, error } = await this.client
      .from("pipeline_entries")
      .select("stage")
      .eq("organization_id", organizationId);

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const stage = row.stage as string;
      counts.set(stage, (counts.get(stage) ?? 0) + 1);
    }

    const order = ["applied", "screening", "interview", "offer", "hired", "rejected"];
    return order
      .filter((stage) => counts.has(stage))
      .map((stage) => ({
        stage,
        count: counts.get(stage) ?? 0,
        label: PIPELINE_LABELS[stage] ?? stage,
      }));
  }

  private async loadOutreachDistribution(
    organizationId: string,
  ): Promise<DashboardOutreachSlice[]> {
    const { data, error } = await this.client
      .from("companies_intelligence")
      .select("outreach_status")
      .eq("organization_id", organizationId);

    if (error) throw error;

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const status = (row.outreach_status as string | null) ?? "none";
      counts.set(status, (counts.get(status) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([status, count]) => ({
      status,
      count,
      label: OUTREACH_LABELS[status] ?? status,
    }));
  }

  private async loadAiRecommendations(
    organizationId: string,
    filters: DashboardFilters,
  ): Promise<DashboardAiRecommendation[]> {
    let query = this.client
      .from("companies_intelligence")
      .select("id, name, current_score, current_priority, current_ai_summary, outreach_status, hiring_intensity")
      .eq("organization_id", organizationId)
      .gte("current_score", 60)
      .order("current_score", { ascending: false, nullsFirst: false })
      .limit(8);

    if (filters.priority && filters.priority !== "all") {
      query = query.eq("current_priority", filters.priority);
    }

    const { data, error } = await query;
    if (error) throw error;

    return ((data ?? []) as CompanyIntelligence[]).map((row) => {
      const outreach = row.outreach_status ?? "none";
      let action = "Bekijk bedrijf en plan outreach";
      let recommendation =
        row.current_ai_summary ??
        `Sterke hiring activiteit (intensity ${row.hiring_intensity ?? 0}).`;

      if (outreach === "none" && (row.current_priority === "A" || row.current_priority === "B")) {
        action = "Start outreach — hoge prioriteit lead";
        recommendation = `Priority ${row.current_priority} lead met score ${row.current_score}. ${recommendation}`;
      } else if (outreach === "draft") {
        action = "Rond outreach concept af";
        recommendation = `Concept klaar voor ${row.name}. Controleer en verstuur.`;
      } else if ((row.hiring_intensity ?? 0) >= 70) {
        action = "Controleer nieuwe hiring signals";
        recommendation = `Hoge hiring intensity (${row.hiring_intensity}). ${recommendation}`;
      }

      return {
        id: row.id,
        companyId: row.id,
        companyName: row.name,
        priority: row.current_priority,
        score: row.current_score,
        recommendation,
        action,
      };
    });
  }

  private async loadTodaysIntelligence(
    organizationId: string,
    todayStart: string,
  ): Promise<DashboardTodaysIntelligence> {
    const empty: DashboardTodaysIntelligence = {
      scanStatus: null,
      signalsCreated: 0,
      signalsUpdated: 0,
      notificationsCreated: 0,
      companiesProcessed: 0,
      companiesTotal: 0,
      lastScanAt: null,
      recentNotifications: [],
    };

    try {
      const [scanResult, notificationsResult] = await Promise.all([
        this.client
          .from("intelligence_scan_runs")
          .select("*")
          .eq("organization_id", organizationId)
          .gte("created_at", todayStart)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        this.client
          .from("intelligence_notifications")
          .select("id, title, message, notification_type, created_at, company_id")
          .eq("organization_id", organizationId)
          .gte("created_at", todayStart)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const scan = scanResult.data as {
        status?: string;
        signals_created?: number;
        signals_updated?: number;
        notifications_created?: number;
        companies_processed?: number;
        companies_total?: number;
        created_at?: string;
      } | null;

      return {
        scanStatus: scan?.status ?? null,
        signalsCreated: scan?.signals_created ?? 0,
        signalsUpdated: scan?.signals_updated ?? 0,
        notificationsCreated: scan?.notifications_created ?? 0,
        companiesProcessed: scan?.companies_processed ?? 0,
        companiesTotal: scan?.companies_total ?? 0,
        lastScanAt: scan?.created_at ?? null,
        recentNotifications: (notificationsResult.data ?? []).map((row) => ({
          id: row.id as string,
          title: row.title as string,
          message: row.message as string,
          notificationType: row.notification_type as string,
          createdAt: row.created_at as string,
          companyId: row.company_id as string,
        })),
      };
    } catch {
      return empty;
    }
  }

  private async loadSignalTrend(
    organizationId: string,
    period: DashboardFilters["period"],
  ): Promise<DashboardSignalTrendPoint[]> {
    const periodStart = periodToStartDate(period);

    const { data, error } = await this.client
      .from("hiring_signals")
      .select("observed_at")
      .eq("organization_id", organizationId)
      .gte("observed_at", periodStart)
      .order("observed_at", { ascending: true });

    if (error) throw error;

    const buckets = new Map<string, number>();
    for (const row of data ?? []) {
      const date = new Date(row.observed_at as string).toISOString().slice(0, 10);
      buckets.set(date, (buckets.get(date) ?? 0) + 1);
    }

    return Array.from(buckets.entries()).map(([date, count]) => ({ date, count }));
  }
}

export {
  OUTREACH_LABELS,
  PIPELINE_LABELS,
  PRIORITY_LABELS,
  SIGNAL_TYPE_LABELS,
} from "@/features/dashboard/domain/dashboard-labels";
