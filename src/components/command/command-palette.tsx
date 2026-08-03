"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Briefcase,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { useCommandPalette } from "@/components/command/command-palette-provider";
import { KeyboardShortcutsDialog } from "@/components/command/keyboard-shortcuts-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  buildNavigationCommands,
  quickActions,
  type CommandAction,
} from "@/config/navigation";
import { cn } from "@/lib/utils";

type SearchResult = {
  companies: Array<{ id: string; name: string; city: string | null; priority: string | null; score: number | null }>;
  vacancies: Array<{ id: string; title: string; companyName: string | null; status: string }>;
};

function scoreAction(query: string, action: CommandAction): number {
  const q = query.trim().toLowerCase();
  if (!q) return action.group === "navigation" ? 1 : 0;

  let score = 0;
  if (action.label.toLowerCase().includes(q)) score += 10;
  if (action.description?.toLowerCase().includes(q)) score += 5;
  if (action.keywords?.some((keyword) => keyword.includes(q) || q.includes(keyword))) score += 8;
  if (action.group === "ai" && (q.includes("ai") || q.includes("vraag") || q.includes("help"))) score += 6;
  return score;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
      {children}
    </kbd>
  );
}

export function CommandPalette() {
  const router = useRouter();
  const { open, setOpen, shortcutsOpen, setShortcutsOpen } = useCommandPalette();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const staticActions = useMemo(
    () => [...buildNavigationCommands(), ...quickActions],
    [],
  );

  const filteredStatic = useMemo(() => {
    return staticActions
      .map((action) => ({ action, score: scoreAction(query, action) }))
      .filter((entry) => entry.score > 0 || !query.trim())
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.action);
  }, [query, staticActions]);

  const entityActions = useMemo((): CommandAction[] => {
    if (!searchResults) return [];

    const companyActions = searchResults.companies.map((company) => ({
      id: `company-${company.id}`,
      label: company.name,
      description: [company.city, company.priority ? `Priority ${company.priority}` : null, company.score?.toString()]
        .filter(Boolean)
        .join(" · "),
      href: `/companies/${company.id}`,
      icon: Building2,
      group: "recent" as const,
    }));

    const vacancyActions = searchResults.vacancies.map((vacancy) => ({
      id: `vacancy-${vacancy.id}`,
      label: vacancy.title,
      description: vacancy.companyName ?? vacancy.status,
      href: `/vacancies/${vacancy.id}`,
      icon: Briefcase,
      group: "recent" as const,
    }));

    return [...companyActions, ...vacancyActions];
  }, [searchResults]);

  const allItems = useMemo(() => {
    const nlAction: CommandAction[] =
      query.trim().length > 8
        ? [
            {
              id: "nl-search",
              label: `AI zoeken: "${query.trim()}"`,
              description: "Natural language company finder",
              href: `/companies?finder=1&q=${encodeURIComponent(query.trim())}`,
              icon: Sparkles,
              group: "ai",
            },
          ]
        : [];

    return [...nlAction, ...entityActions, ...filteredStatic];
  }, [entityActions, filteredStatic, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, allItems.length]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setSearchResults(null);
      return;
    }

    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSearchResults(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=6`, {
          signal: controller.signal,
        });
        if (response.ok) {
          setSearchResults((await response.json()) as SearchResult);
        }
      } catch {
        if (!controller.signal.aborted) setSearchResults(null);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  const execute = useCallback(
    (action: CommandAction) => {
      setOpen(false);
      if (action.href) {
        router.push(action.href);
      }
      action.onSelect?.();
    },
    [router, setOpen],
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((current) => Math.min(current + 1, allItems.length - 1));
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((current) => Math.max(current - 1, 0));
      }
      if (event.key === "Enter" && allItems[activeIndex]) {
        event.preventDefault();
        execute(allItems[activeIndex]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, allItems, execute, open]);

  if (!open && !shortcutsOpen) return null;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
            aria-label="Sluit command palette"
            onClick={() => setOpen(false)}
          />
          <div className="relative mx-auto mt-[min(16vh,120px)] w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-xl border bg-popover shadow-2xl ring-1 ring-foreground/10">
            <div className="flex items-center gap-2 border-b px-3">
              {isSearching ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <Search className="size-4 shrink-0 text-muted-foreground" />
              )}
              <Input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Zoek bedrijven, navigeer, of stel een AI-vraag…"
                className="h-12 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
              />
              <Kbd>esc</Kbd>
            </div>

            <ScrollArea className="max-h-[min(420px,50vh)]">
              <div className="p-2">
                {allItems.length === 0 ? (
                  <p className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Geen resultaten — probeer een bedrijfsnaam of ⌘/ voor AI Copilot
                  </p>
                ) : (
                  allItems.map((action, index) => {
                    const Icon = action.icon ?? ArrowRight;
                    return (
                      <button
                        key={action.id}
                        type="button"
                        onClick={() => execute(action)}
                        onMouseEnter={() => setActiveIndex(index)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors",
                          index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
                        )}
                      >
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{action.label}</p>
                          {action.description ? (
                            <p className="truncate text-xs text-muted-foreground">{action.description}</p>
                          ) : null}
                        </div>
                        {action.shortcut ? <Kbd>{action.shortcut}</Kbd> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between border-t px-3 py-2 text-[10px] text-muted-foreground">
              <span>↑↓ navigeren · ↵ openen · ? sneltoetsen</span>
              <button
                type="button"
                className="hover:text-foreground"
                onClick={() => {
                  setOpen(false);
                  router.push("/companies?finder=1");
                }}
              >
                AI Company Finder
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </>
  );
}
