"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

import { GOTO_ROUTES } from "@/config/keyboard-shortcuts";

type CommandPaletteContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
};

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const pendingGoRef = useRef<string | null>(null);
  const goTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toggle = useCallback(() => setOpen((current) => !current), []);

  useEffect(() => {
    function isEditableTarget(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target.isContentEditable
      );
    }

    function onKeyDown(event: KeyboardEvent) {
      if (isEditableTarget(event.target) && !event.metaKey && !event.ctrlKey) {
        if (event.key !== "Escape") return;
      }

      const meta = event.metaKey || event.ctrlKey;

      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
        return;
      }

      if (meta && event.key === "/") {
        event.preventDefault();
        router.push("/copilot");
        return;
      }

      if (event.key === "?" && !meta && !event.altKey && !isEditableTarget(event.target)) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }

      if (event.key === "Escape") {
        setOpen(false);
        setShortcutsOpen(false);
        pendingGoRef.current = null;
        if (goTimeoutRef.current) clearTimeout(goTimeoutRef.current);
        return;
      }

      if (open || shortcutsOpen || meta || event.altKey || isEditableTarget(event.target)) {
        return;
      }

      if (event.key === "g") {
        pendingGoRef.current = "g";
        if (goTimeoutRef.current) clearTimeout(goTimeoutRef.current);
        goTimeoutRef.current = setTimeout(() => {
          pendingGoRef.current = null;
        }, 800);
        return;
      }

      if (pendingGoRef.current === "g") {
        const route = GOTO_ROUTES[event.key];
        pendingGoRef.current = null;
        if (goTimeoutRef.current) clearTimeout(goTimeoutRef.current);
        if (route) {
          event.preventDefault();
          router.push(route);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, router, shortcutsOpen]);

  const value = useMemo(
    () => ({ open, setOpen, toggle, shortcutsOpen, setShortcutsOpen }),
    [open, shortcutsOpen, toggle],
  );

  return (
    <CommandPaletteContext.Provider value={value}>{children}</CommandPaletteContext.Provider>
  );
}

export function useCommandPalette() {
  const context = useContext(CommandPaletteContext);
  if (!context) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return context;
}
