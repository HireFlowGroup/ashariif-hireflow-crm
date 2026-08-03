"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Filter, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DashboardFilters, DashboardPeriod } from "@/features/dashboard/domain/dashboard.types";
import { buildDashboardFilterUrl } from "@/lib/dashboard/filters";
import { cn } from "@/lib/utils";

type DashboardFiltersBarProps = {
  filters: DashboardFilters;
  sectors?: string[];
  className?: string;
};

const PERIOD_OPTIONS: Array<{ value: DashboardPeriod; label: string }> = [
  { value: "today", label: "Vandaag" },
  { value: "7d", label: "7 dagen" },
  { value: "30d", label: "30 dagen" },
];

const PRIORITY_OPTIONS = [
  { value: "all", label: "Alle prioriteiten" },
  { value: "A", label: "Priority A" },
  { value: "B", label: "Priority B" },
  { value: "C", label: "Priority C" },
  { value: "D", label: "Priority D" },
] as const;

export function DashboardFiltersBar({ filters, sectors = [], className }: DashboardFiltersBarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const applyFilters = useCallback(
    (patch: Partial<DashboardFilters>) => {
      const next: DashboardFilters = {
        ...filters,
        ...patch,
      };

      startTransition(() => {
        router.push(buildDashboardFilterUrl(next));
      });
    },
    [filters, router],
  );

  function resetFilters() {
    startTransition(() => {
      router.push("/dashboard");
    });
  }

  const currentPriority = filters.priority ?? "all";
  const sectorValue = searchParams.get("sector") ?? filters.sector ?? "";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-end lg:justify-between",
        isPending && "opacity-70",
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Periode</label>
          <div className="flex rounded-lg border p-0.5">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => applyFilters({ period: option.value })}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  filters.period === option.value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Prioriteit</label>
          <select
            value={currentPriority}
            onChange={(event) => {
              const value = event.target.value;
              applyFilters({
                priority: value === "all" ? undefined : (value as DashboardFilters["priority"]),
              });
            }}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Sector</label>
          <Input
            list="dashboard-sectors"
            placeholder="Alle sectoren"
            defaultValue={sectorValue}
            className="h-9 w-40"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                applyFilters({ sector: event.currentTarget.value.trim() || undefined });
              }
            }}
            onBlur={(event) => {
              const value = event.currentTarget.value.trim();
              if (value !== (filters.sector ?? "")) {
                applyFilters({ sector: value || undefined });
              }
            }}
          />
          {sectors.length > 0 ? (
            <datalist id="dashboard-sectors">
              {sectors.map((sector) => (
                <option key={sector} value={sector} />
              ))}
            </datalist>
          ) : null}
        </div>

        <Button variant="outline" size="sm" onClick={resetFilters} className="h-9">
          <RotateCcw className="mr-2 size-3.5" />
          Reset
        </Button>
      </div>
    </div>
  );
}
