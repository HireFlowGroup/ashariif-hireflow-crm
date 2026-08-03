"use client";

import { CommandPalette } from "@/components/command/command-palette";
import { CommandPaletteProvider } from "@/components/command/command-palette-provider";

export function AppShellClient({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      {children}
      <CommandPalette />
    </CommandPaletteProvider>
  );
}
