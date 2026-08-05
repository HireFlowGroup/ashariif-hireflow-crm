import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  BdChartPeriod,
  BdDailyTrendPoint,
  BdDashboardMetrics,
  BdTodayKpis,
} from "@/features/dashboard/domain/dashboard.types";
import { daysAgoStartIso, todayStartIso } from "@/features/dashboard/domain/dashboard.types";
import type { Database } from "@/types/database";

const POSITIVE_REPLY_CLASSIFICATIONS = new Set([
  "interesse",
  "positive",
  "referral",
  "interested_later",
]);

const DRAFT_STATUSES = new Set(["draft", "pending_approval"]);

type TrendAccumulator = Omit<BdDailyTrendPoint, "date">;

function emptyAccumulator(): TrendAccumulator {
  return {
    companiesFound: 0,
    analyzed: 0,
    newContacts: 0,
    draftEmails: 0,
    sentEmails: 0,
    openReplies: 0,
    positiveReplies: 0,
    intakes: 0,
    newVacancies: 0,
    candidatesProposed: 0,
    placements: 0,
  };
}

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function buildTrendSkeleton(days: number): Map<string, BdDailyTrendPoint> {
  const map = new Map<string, BdDailyTrendPoint>();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));

  for (let index = 0; index < days; index += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    const key = day.toISOString().slice(0, 10);
    map.set(key, { date: key, ...emptyAccumulator() });
  }

  return map;
}

function sliceTrend(map: Map<string, BdDailyTrendPoint>, days: number): BdDailyTrendPoint[] {
  return Array.from(map.values()).slice(-days);
}

function incrementTrend(
  map: Map<string, BdDailyTrendPoint>,
  iso: string,
  field: keyof TrendAccumulator,
): void {
  const key = dateKey(iso);
  const point = map.get(key);
  if (point) {
    point[field] += 1;
  }
}

function computeConversionRate(placements: number, companiesFound: number): number {
  if (companiesFound <= 0) return 0;
  return Math.round((placements / companiesFound) * 1000) / 10;
}

function todayFromTrend(map: Map<string, BdDailyTrendPoint>, pipelineValue: number, openReplies: number): BdTodayKpis {
  const todayKey = todayStartIso().slice(0, 10);
  const todayPoint = map.get(todayKey) ?? { date: todayKey, ...emptyAccumulator() };

  return {
    companiesFound: todayPoint.companiesFound,
    analyzed: todayPoint.analyzed,
    newContacts: todayPoint.newContacts,
    draftEmails: todayPoint.draftEmails,
    sentEmails: todayPoint.sentEmails,
    openReplies,
    positiveReplies: todayPoint.positiveReplies,
    intakes: todayPoint.intakes,
    newVacancies: todayPoint.newVacancies,
    candidatesProposed: todayPoint.candidatesProposed,
    placements: todayPoint.placements,
    conversionRate: computeConversionRate(todayPoint.placements, todayPoint.companiesFound),
    pipelineValue,
  };
}

export async function loadBdDashboardMetrics(
  client: SupabaseClient<Database>,
  organizationId: string,
): Promise<BdDashboardMetrics> {
  const trendMap = buildTrendSkeleton(90);
  const periodStart = daysAgoStartIso(90);
  let pipelineValue = 0;
  let openReplies = 0;

  const [
    companiesResult,
    contactsResult,
    vacanciesResult,
    outreachResult,
    pipelineResult,
  ] = await Promise.all([
    client
      .from("companies")
      .select("created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart)
      .neq("status", "inactive"),
    client
      .from("contacts")
      .select("created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart),
    client
      .from("vacancies")
      .select("created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart),
    client
      .from("outreach_messages" as never)
      .select("created_at, sent_at, status")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart),
    client
      .from("commercial_pipeline_cards")
      .select("stage, moved_at, deal_value")
      .eq("organization_id", organizationId),
  ]);

  for (const row of companiesResult.data ?? []) {
    incrementTrend(trendMap, row.created_at as string, "companiesFound");
  }

  for (const row of contactsResult.data ?? []) {
    incrementTrend(trendMap, row.created_at as string, "newContacts");
  }

  for (const row of vacanciesResult.data ?? []) {
    incrementTrend(trendMap, row.created_at as string, "newVacancies");
  }

  for (const row of (outreachResult.data ?? []) as Array<{
    created_at: string;
    sent_at: string | null;
    status: string;
  }>) {
    if (DRAFT_STATUSES.has(row.status)) {
      incrementTrend(trendMap, row.created_at, "draftEmails");
    }
    if (row.sent_at) {
      incrementTrend(trendMap, row.sent_at, "sentEmails");
    }
  }

  for (const row of pipelineResult.data ?? []) {
    const stage = row.stage as string;
    const movedAt = row.moved_at as string;
    const dealValue = row.deal_value ? Number(row.deal_value) : 0;

    if (stage !== "verloren") {
      pipelineValue += dealValue;
    }

    if (stage === "reactie_ontvangen") {
      openReplies += 1;
    }

    if (stage === "intake_gepland") {
      incrementTrend(trendMap, movedAt, "intakes");
    }
    if (stage === "voorstellen_gedaan") {
      incrementTrend(trendMap, movedAt, "candidatesProposed");
    }
    if (stage === "plaatsing") {
      incrementTrend(trendMap, movedAt, "placements");
    }
  }

  try {
    const analysesResult = await client
      .from("recruitment_intelligence_analyses" as never)
      .select("created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart);

    for (const row of (analysesResult.data ?? []) as Array<{ created_at: string }>) {
      incrementTrend(trendMap, row.created_at, "analyzed");
    }
  } catch {
    // table may not exist until migration is applied
  }

  try {
    const repliesResult = await client
      .from("ai_recruiter_replies" as never)
      .select("created_at, classification")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart);

    for (const row of (repliesResult.data ?? []) as Array<{
      created_at: string;
      classification: string;
    }>) {
      incrementTrend(trendMap, row.created_at, "openReplies");
      if (POSITIVE_REPLY_CLASSIFICATIONS.has(row.classification)) {
        incrementTrend(trendMap, row.created_at, "positiveReplies");
      }
    }
  } catch {
    // table may not exist until migration is applied
  }

  const today = todayFromTrend(trendMap, pipelineValue, openReplies);

  return {
    today,
    trends: {
      "7d": sliceTrend(trendMap, 7),
      "30d": sliceTrend(trendMap, 30),
      "90d": sliceTrend(trendMap, 90),
    },
  };
}

export function sumTrendField(points: BdDailyTrendPoint[], field: keyof TrendAccumulator): number {
  return points.reduce((total, point) => total + point[field], 0);
}

export function periodConversionRate(points: BdDailyTrendPoint[]): number {
  return computeConversionRate(
    sumTrendField(points, "placements"),
    sumTrendField(points, "companiesFound"),
  );
}
