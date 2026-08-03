import { NextResponse } from "next/server";

import {
  createDailyIntelligenceServices,
  isDailyIntelligenceConfigured,
} from "@/features/daily-intelligence/create-daily-intelligence-service";
import { verifyCronOrWorkerSecret } from "@/lib/api/cron-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

async function handleQueueProcessing() {
  if (!isDailyIntelligenceConfigured()) {
    return NextResponse.json(
      { error: "Daily Intelligence niet geconfigureerd (CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY)." },
      { status: 503 },
    );
  }

  const { worker } = createDailyIntelligenceServices();
  const result = await worker.processBatch();

  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: Request) {
  if (!verifyCronOrWorkerSecret(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  return handleQueueProcessing();
}

export async function POST(request: Request) {
  if (!verifyCronOrWorkerSecret(request)) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  return handleQueueProcessing();
}
