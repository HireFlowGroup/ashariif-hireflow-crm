import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CandidateSourcingClient } from "@/components/candidates/candidate-sourcing-client";
import { PageHeader } from "@/components/layout/page-header";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { authRoutes } from "@/config/navigation";

export const metadata: Metadata = {
  title: "Candidates",
};

export default async function CandidatesPage() {
  const context = await getAuthenticatedServiceContext();
  if (!context) {
    redirect(authRoutes.login);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Candidates"
        description="AI Candidate Sourcing via publiek geïndexeerde LinkedIn-profielen (x-ray). Handmatige goedkeuring, geen automatische verzending."
      />
      <CandidateSourcingClient />
    </div>
  );
}