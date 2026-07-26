import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/shared/empty-state";

export const metadata: Metadata = {
  title: "Vacancies",
};

export default function VacanciesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacancies"
        description="Publish and track open roles across client companies."
      />
      <EmptyState
        title="No vacancies created"
        description="Define job requisitions linked to companies to start filling your hiring pipeline."
      />
    </div>
  );
}
