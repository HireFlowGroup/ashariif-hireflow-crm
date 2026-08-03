"use client";

import type { User } from "@supabase/supabase-js";
import { BrainCircuit, Search } from "lucide-react";

import { useCommandPalette } from "@/components/command/command-palette-provider";
import { IntelligenceNotificationsBell } from "@/components/intelligence/intelligence-notifications-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import Link from "next/link";
import { UserNav } from "@/components/layout/user-nav";
import { SidebarTrigger } from "@/components/ui/sidebar";

type DashboardHeaderProps = {
  user: User;
};

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const { setOpen } = useCommandPalette();

  return (
    <header className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border/60 bg-background/80 px-3 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <SidebarTrigger className="-ml-0.5 size-8" />

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex h-8 min-w-0 flex-1 max-w-md items-center gap-2 rounded-md border border-transparent bg-muted/40 px-3 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/70 md:max-w-lg"
      >
        <Search className="size-3.5 shrink-0 opacity-60" />
        <span className="truncate text-left">Zoeken of commando…</span>
        <kbd className="ml-auto hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground md:inline">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1">
        <Link
          href="/copilot"
          aria-label="AI Copilot"
          className="hidden size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:inline-flex"
        >
          <BrainCircuit className="size-4" />
        </Link>
        <IntelligenceNotificationsBell />
        <ThemeToggle />
        <UserNav user={user} />
      </div>
    </header>
  );
}
