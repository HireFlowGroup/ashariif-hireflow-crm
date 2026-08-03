import type { ReactNode } from "react";

import { AppShellClient } from "@/components/layout/app-shell-client";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { authRoutes } from "@/config/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function DashboardShell({ children }: { children: ReactNode }) {
  const user = await getSessionUser();

  if (!user) {
    redirect(authRoutes.login);
  }

  return (
    <AppShellClient>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="min-h-svh bg-background">
          <DashboardHeader user={user} />
          <main className="flex flex-1 flex-col">{children}</main>
        </SidebarInset>
      </SidebarProvider>
    </AppShellClient>
  );
}
