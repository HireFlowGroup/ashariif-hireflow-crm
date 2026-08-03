import type { Metadata } from "next";

import { ProvidersSettingsClient } from "@/components/settings/providers-settings-client";

export const metadata: Metadata = {
  title: "Providers",
};

export default function ProvidersSettingsPage() {
  return <ProvidersSettingsClient />;
}
