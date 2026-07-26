import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Track pipeline health, open vacancies, and team activity."
      />
      <EmptyState
        title="No analytics yet"
        description="Connect Supabase tables and seed your workspace to populate dashboard metrics."
      />
    </div>
  );
}
