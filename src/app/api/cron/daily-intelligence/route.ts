import { NextResponse } from "next/server";

import {
  createDailyIntelligenceServices,
  isDailyIntelligenceConfigured,
} from "@/features/daily-intelligence/create-daily-intelligence-service";
import { verifyCronSecret } from "@/lib/api/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

async function handleDailyIntelligence() {
  if (!isDailyIntelligenceConfigured()) {
    return NextResponse.json(
      { error: "Daily Intelligence niet geconfigureerd (CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const { scheduler, worker } = createDailyIntelligenceServices();
  const scheduleResult = await scheduler.scheduleNightlyScans("cron");

  const workerResult =
    scheduleResult.jobsEnqueued > 0
      ? await worker.processBatch()
      : { workerId: "skipped", claimed: 0, completed: 0, failed: 0, staleReleased: 0, runsFinalized: 0 };

  return NextResponse.json({
    ok: true,
    schedule: scheduleResult,
    worker: workerResult,
  });
}

export async function GET(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  return handleDailyIntelligence();
}

export async function POST(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  return handleDailyIntelligence();
}
