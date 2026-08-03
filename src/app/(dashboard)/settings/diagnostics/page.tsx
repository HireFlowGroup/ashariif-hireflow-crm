import type { Metadata } from "next";

import { DiagnosticsSettingsClient } from "@/components/settings/diagnostics-settings-client";

export const metadata: Metadata = {
  title: "Diagnostics",
};

export default function DiagnosticsSettingsPage() {
  return <DiagnosticsSettingsClient />;
}
