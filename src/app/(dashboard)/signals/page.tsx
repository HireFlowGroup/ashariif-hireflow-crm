import type { Metadata } from "next";

import { GlobalSignalsFeed } from "@/components/signals/global-signals-feed";
import { WorkspacePage } from "@/components/layout/workspace-page";

export const metadata: Metadata = {
  title: "Signals",
};

export default function SignalsPage() {
  return (
    <WorkspacePage
      title="Signals"
      description="Alle hiring signals — gefilterd op belang en recency."
    >
      <GlobalSignalsFeed />
    </WorkspacePage>
  );
}
