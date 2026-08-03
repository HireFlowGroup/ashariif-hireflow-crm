"use client";

import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { ContextMenuProvider } from "@/components/ui/context-menu-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import type { ReactNode } from "react";

type AppProvidersProps = {
  children: ReactNode;
};

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryProvider>
        <TooltipProvider delay={0}>
          <ContextMenuProvider>
            {children}
            <Toaster richColors closeButton position="top-right" />
          </ContextMenuProvider>
        </TooltipProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
