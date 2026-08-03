import type { Metadata } from "next";

import { TodayIntelligenceFeed } from "@/components/intelligence/today-intelligence-feed";
import { WorkspacePage } from "@/components/layout/workspace-page";

export const metadata: Metadata = {
  title: "Intelligence",
  description: "Live recruitment intelligence feed",
};

export default function IntelligencePage() {
  return (
    <WorkspacePage
      title="Intelligence"
      description="Realtime updates — hiring signals, score changes, AI analyses en kansen."
      bleed
    >
      <TodayIntelligenceFeed />
    </WorkspacePage>
  );
}
