import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = {
  title: "Companies",
};

export default function CompaniesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Companies"
        description="Manage client organizations, account status, and hiring partnerships."
      />
      <EmptyState
        title="No companies recorded"
        description="Create your first company once Supabase migrations are applied and RLS policies are configured."
      />
    </div>
  );
}
