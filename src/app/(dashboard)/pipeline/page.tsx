import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function PipelinePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        description="Move candidates through structured hiring stages by vacancy."
      />
      <EmptyState
        title="Pipeline board is empty"
        description="Pipeline entries appear when candidates are associated with active vacancies."
      />
    </div>
  );
}
