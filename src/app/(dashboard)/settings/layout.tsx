import { SettingsNav } from "@/components/settings/settings-nav";

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Settings</h2>
      </div>
      <SettingsNav />
      {children}
    </div>
  );
}
