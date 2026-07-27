import type { Metadata } from "next";
import { AiAssistantPanel } from "@/components/ai/ai-assistant-panel";
import { PageHeader } from "@/components/layout/page-header";
import { isOpenAIConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "AI Workspace",
  description: "Beheer bedrijven in gewone taal met HireFlow AI en CRM-tools.",
};

export default function AiAssistantPage() {
  const isConfigured = isOpenAIConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        title="HireFlow AI"
        description="Chat met de assistent om bedrijven aan te maken, te zoeken, te openen, bij te werken, te archiveren of soft te verwijderen — zonder aparte formulieren."
      />
      <AiAssistantPanel isConfigured={isConfigured} />
    </div>
  );
}
