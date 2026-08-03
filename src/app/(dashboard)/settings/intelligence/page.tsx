import type { Metadata } from "next";

import { IntelligenceSettingsClient } from "@/components/settings/intelligence-settings-client";

export const metadata: Metadata = {
  title: "Daily Intelligence",
};

export default function IntelligenceSettingsPage() {
  return <IntelligenceSettingsClient />;
}
