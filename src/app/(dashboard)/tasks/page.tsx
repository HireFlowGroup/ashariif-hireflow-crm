import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = {
  title: "Tasks",
};

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks"
        description="Coordinate recruiter follow-ups and team assignments."
      />
      <EmptyState
        title="No tasks assigned"
        description="Create tasks linked to companies, contacts, candidates, or vacancies."
      />
    </div>
  );
}
