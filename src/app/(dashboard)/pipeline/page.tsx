import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CommercialPipelineBoardView } from "@/components/commercial-pipeline/commercial-pipeline-board";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { createCommercialPipelineService } from "@/features/commercial-pipeline/create-commercial-pipeline-service";
import { authRoutes } from "@/config/navigation";
import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";

export const metadata: Metadata = {
  title: "Commerciële Pipeline",
  description: "BD pipeline — van prospect tot plaatsing.",
};

export const dynamic = "force-dynamic";

export default async function CommercialPipelinePage() {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    redirect(authRoutes.login);
  }

  const service = await createCommercialPipelineService();
  const board = await service.getBoard(context.organizationId);

  return (
    <WorkspacePage
      title="Commerciële Pipeline"
      description="AI Business Development — sleep deals door elke fase van eerste contact tot plaatsing."
      bleed
    >
      <div className="px-4 pb-6 md:px-6">
        <CommercialPipelineBoardView initialBoard={board} />
      </div>
    </WorkspacePage>
  );
}
