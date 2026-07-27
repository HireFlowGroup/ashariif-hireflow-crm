import type { Metadata } from "next";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { PageHeader } from "@/components/layout/page-header";
import { isOpenAIConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "AI Workspace",
};

export default function AiAssistantPage() {
  const isConfigured = isOpenAIConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Workspace"
        description="Recruitment-, sales- en planningassistent met live streaming antwoorden."
      />
      <AiAssistantPanel isConfigured={isConfigured} />
    </div>
  );
}
