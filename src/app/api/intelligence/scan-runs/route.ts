import { NextResponse } from "next/server";

import {
  createDailyIntelligenceServices,
  isDailyIntelligenceConfigured,
} from "@/features/daily-intelligence/create-daily-intelligence-service";
import { getDailySchedulerConfig } from "@/features/daily-intelligence/config/scheduler.config";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export async function GET(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "10", 10), 50);

  if (!isDailyIntelligenceConfigured()) {
    return NextResponse.json({ runs: [], configured: false });
  }

  const { scanRepository } = createDailyIntelligenceServices();
  const runs = await scanRepository.listRecentRuns(context.organizationId, limit);

  return NextResponse.json({ runs, configured: true });
}

export async function POST() {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  if (!isDailyIntelligenceConfigured()) {
    return NextResponse.json(
      { error: "Daily Intelligence niet geconfigureerd op de server." },
      { status: 503 },
    );
  }

  const config = getDailySchedulerConfig();
  const { scanRepository, worker } = createDailyIntelligenceServices();

  const activeRun = await scanRepository.findActiveRunForOrganization(context.organizationId);

  if (activeRun) {
    return NextResponse.json(
      { error: "Er loopt al een scan voor vandaag.", runId: activeRun.id },
      { status: 409 },
    );
  }

  const targets = await scanRepository.listOrganizationsWithCompanies();
  const target = targets.find((entry) => entry.organizationId === context.organizationId);

  if (!target || target.companyCount === 0) {
    return NextResponse.json({ error: "Geen bedrijven om te scannen." }, { status: 400 });
  }

  const run = await scanRepository.createRun({
    organizationId: context.organizationId,
    triggeredBy: "manual",
    companiesTotal: target.companyCount,
  });

  await scanRepository.updateRunStatus(run.id, "running", {
    startedAt: new Date().toISOString(),
  });

  let offset = 0;
  let jobsEnqueued = 0;
  let staggerIndex = 0;

  while (true) {
    const companyIds = await scanRepository.getCompanyIdsForOrganization(
      context.organizationId,
      config.companiesPerBatch,
      offset,
    );

    if (companyIds.length === 0) break;

    const scheduledAt = new Date(
      Date.now() + staggerIndex * config.delayBetweenCompaniesMs,
    ).toISOString();

    jobsEnqueued += await scanRepository.enqueueJobs(
      companyIds.map((companyId) => ({
        runId: run.id,
        organizationId: context.organizationId,
        companyId,
        scheduledAt,
        maxAttempts: config.maxAttempts,
      })),
    );

    offset += config.companiesPerBatch;
    staggerIndex += 1;
  }

  const workerResult = await worker.processBatch();

  return NextResponse.json({
    ok: true,
    runId: run.id,
    jobsEnqueued,
    worker: workerResult,
  });
}
