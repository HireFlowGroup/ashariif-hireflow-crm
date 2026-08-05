import { Suspense } from "react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { RecruitmentIntelligenceDashboard } from "@/components/dashboard/recruitment-intelligence-dashboard";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { createCommercialPipelineService } from "@/features/commercial-pipeline/create-commercial-pipeline-service";
import { createDashboardService } from "@/features/dashboard/create-dashboard-service";
import { parseDashboardFilters } from "@/lib/dashboard/filters";
import { authRoutes } from "@/config/navigation";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Recruitment Intelligence",
  description: "Realtime hiring signals, warme leads en AI-aanbevelingen.",
};

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    period?: string;
    priority?: string;
    sector?: string;
  }>;
};

async function DashboardContent({
  searchParams,
}: {
  searchParams: DashboardPageProps["searchParams"];
}) {
  const user = await getSessionUser();
  if (!user) redirect(authRoutes.login);

  const profile = await getSessionProfile();
  const params = await searchParams;
  const filters = parseDashboardFilters(params);

  if (!profile) {
    return (
      <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        Profiel kon niet worden geladen.
      </p>
    );
  }

  const dashboardService = await createDashboardService();
  const commercialPipelineService = await createCommercialPipelineService();

  const [snapshot, commercialPipelineBoard] = await Promise.all([
    dashboardService.getSnapshot(
      { userId: user.id, organizationId: profile.organization_id },
      filters,
    ),
    commercialPipelineService.getBoard(profile.organization_id),
  ]);

  const sectors = [
    ...new Set(snapshot.warmLeads.map((lead) => lead.sector).filter(Boolean) as string[]),
  ].slice(0, 20);

  return (
    <WorkspacePage
      title="Dashboard"
      description="Realtime BD-operatie — van prospect tot plaatsing, live bijgewerkt."
    >
      <RecruitmentIntelligenceDashboard
        initialSnapshot={snapshot}
        sectors={sectors}
        commercialPipelineBoard={commercialPipelineBoard}
      />
    </WorkspacePage>
  );
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent searchParams={searchParams} />
    </Suspense>
  );
}
