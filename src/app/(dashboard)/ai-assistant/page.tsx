import type { Metadata } from "next";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { PageHeader } from "@/components/layout/page-header";
import { isOpenAIConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "AI Assistant",
};

export default function AiAssistantPage() {
  const isConfigured = isOpenAIConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Assistant"
        description="Recruiting copilot for screening guidance, outreach, and interview preparation."
      />
      <AiAssistantPanel isConfigured={isConfigured} />
    </div>
  );
}
