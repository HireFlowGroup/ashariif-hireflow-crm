import { NextResponse } from "next/server";

import { createCompanyAnalysisService } from "@/features/company-ai-analysis/create-company-analysis-service";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ companyId: string }> };

export async function GET(request: Request, routeContext: RouteContext) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { companyId } = await routeContext.params;
  const { searchParams } = new URL(request.url);
  const generateIfMissing = searchParams.get("generateIfMissing") === "true";

  const service = await createCompanyAnalysisService();
  const result = await service.getAnalysis(context, companyId, { generateIfMissing });

  return NextResponse.json(result);
}

export async function POST(_request: Request, routeContext: RouteContext) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { companyId } = await routeContext.params;
  const service = await createCompanyAnalysisService();
  const analysis = await service.ensureFreshAnalysis(context, companyId, { force: true });

  if (!analysis) {
    return NextResponse.json({ error: "Bedrijf niet gevonden" }, { status: 404 });
  }

  return NextResponse.json({
    analysis,
    isStale: false,
    generatedAt: new Date().toISOString(),
  });
}
