import type { Metadata } from "next";
import { BrainCircuit } from "lucide-react";

import { RecruitmentCopilot } from "@/components/ai/recruitment-copilot";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { Badge } from "@/components/ui/badge";
import { isOpenAIConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "AI Copilot",
  description: "Recruitment intelligence assistant — structured tools + RAG",
};

export default function CopilotPage() {
  const isConfigured = isOpenAIConfigured();

  return (
    <WorkspacePage
      title="AI Copilot"
      description="Stel vragen over leads, hiring signals en vacatures. Onderbouwd met HireFlow-data."
      bleed
      actions={
        <div className="hidden flex-wrap gap-2 sm:flex">
          <Badge variant="secondary" className="gap-1 font-normal">
            <BrainCircuit className="size-3.5" />
            Structured tools
          </Badge>
          <Badge variant="outline" className="font-normal">
            Streaming
          </Badge>
        </div>
      }
    >
      <RecruitmentCopilot isConfigured={isConfigured} />
    </WorkspacePage>
  );
}
