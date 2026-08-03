import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";

import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { createDashboardService } from "@/features/dashboard/create-dashboard-service";
import { parseDashboardFilters } from "@/lib/dashboard/filters";
import { authRoutes } from "@/config/navigation";
import { getSessionProfile, getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Analytics",
};

export const dynamic = "force-dynamic";

async function AnalyticsContent() {
  const user = await getSessionUser();
  if (!user) redirect(authRoutes.login);

  const profile = await getSessionProfile();
  if (!profile) return null;

  const dashboardService = await createDashboardService();
  const snapshot = await dashboardService.getSnapshot(
    { userId: user.id, organizationId: profile.organization_id },
    parseDashboardFilters({ period: "30d" }),
  );

  return <AnalyticsDashboard snapshot={snapshot} />;
}

export default function AnalyticsPage() {
  return (
    <WorkspacePage
      title="Analytics"
      description="Trends in hiring activity, lead scores en outreach — data-driven recruitment intelligence."
    >
      <Suspense fallback={<DashboardSkeleton />}>
        <AnalyticsContent />
      </Suspense>
    </WorkspacePage>
  );
}
