import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = {
  title: "Candidates",
};

export default function CandidatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="Maintain candidate profiles, sources, and hiring status."
      />
      <EmptyState
        title="No candidates in the pipeline"
        description="Add candidates manually or integrate sourcing channels through Supabase-backed services."
      />
    </div>
  );
}
