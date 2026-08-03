"use client";

import { KEYBOARD_SHORTCUTS } from "@/config/keyboard-shortcuts";

type KeyboardShortcutsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  if (!open) return null;

  const groups = [
    { id: "global", label: "Globaal" },
    { id: "navigation", label: "Navigatie" },
  ] as const;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        className="absolute inset-0 bg-background/60 backdrop-blur-sm"
        aria-label="Sluit sneltoetsen"
        onClick={() => onOpenChange(false)}
      />
      <div className="relative mx-auto mt-[min(12vh,96px)] w-[min(520px,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover shadow-2xl ring-1 ring-foreground/10">
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">Sneltoetsen</h2>
          <p className="text-xs text-muted-foreground">Linear-style keyboard navigation</p>
        </div>
        <div className="max-h-[60vh] overflow-auto p-4 space-y-6">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {group.label}
              </p>
              <div className="space-y-2">
                {KEYBOARD_SHORTCUTS.filter((shortcut) => shortcut.group === group.id).map((shortcut) => (
                  <div key={shortcut.id} className="flex items-center justify-between gap-4 text-sm">
                    <span>{shortcut.label}</span>
                    <kbd className="rounded border bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                      {shortcut.display}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
