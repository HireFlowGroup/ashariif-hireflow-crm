"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type ContextMenuItem = {
  id: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

type ContextMenuState = {
  x: number;
  y: number;
  items: ContextMenuItem[];
} | null;

const ContextMenuContext = createContext<{
  openMenu: (event: React.MouseEvent, items: ContextMenuItem[]) => void;
  closeMenu: () => void;
} | null>(null);

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState<ContextMenuState>(null);

  const closeMenu = useCallback(() => setMenu(null), []);

  const openMenu = useCallback((event: React.MouseEvent, items: ContextMenuItem[]) => {
    event.preventDefault();
    event.stopPropagation();
    setMenu({ x: event.clientX, y: event.clientY, items });
  }, []);

  useEffect(() => {
    if (!menu) return;
    function onDismiss() {
      closeMenu();
    }
    window.addEventListener("click", onDismiss);
    window.addEventListener("scroll", onDismiss, true);
    window.addEventListener("keydown", onDismiss);
    return () => {
      window.removeEventListener("click", onDismiss);
      window.removeEventListener("scroll", onDismiss, true);
      window.removeEventListener("keydown", onDismiss);
    };
  }, [closeMenu, menu]);

  return (
    <ContextMenuContext.Provider value={{ openMenu, closeMenu }}>
      {children}
      {menu && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed z-[100] min-w-44 overflow-hidden rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg ring-1 ring-foreground/10"
              style={{ top: menu.y, left: menu.x }}
              onClick={(event) => event.stopPropagation()}
            >
              {menu.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => {
                    if (!item.disabled) {
                      item.onSelect();
                      closeMenu();
                    }
                  }}
                  className={cn(
                    "flex w-full rounded-md px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-50",
                    item.destructive && "text-destructive hover:bg-destructive/10",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </ContextMenuContext.Provider>
  );
}

export function useContextMenu() {
  const context = useContext(ContextMenuContext);
  if (!context) {
    throw new Error("useContextMenu must be used within ContextMenuProvider");
  }
  return context;
}
