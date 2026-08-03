"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VacanciesFilters,
  type VacanciesFilterState,
} from "@/components/vacancies/vacancies-filters";
import { VacanciesTable } from "@/components/vacancies/vacancies-table";
import { VacancyEmptyState } from "@/components/vacancies/vacancy-empty-state";
import type { CompanyOption, VacancyListItem } from "@/components/vacancies/types";

const DEFAULT_FILTERS: VacanciesFilterState = {
  query: "",
  status: "",
  companyId: "",
  employmentType: "",
};

type VacanciesOverviewProps = {
  companies: CompanyOption[];
};

export function VacanciesOverview({ companies }: VacanciesOverviewProps) {
  const [filters, setFilters] = useState<VacanciesFilterState>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] =
    useState<VacanciesFilterState>(DEFAULT_FILTERS);
  const [vacancies, setVacancies] = useState<VacancyListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const limit = 20;

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        appliedFilters.query.trim() ||
          appliedFilters.status ||
          appliedFilters.companyId ||
          appliedFilters.employmentType,
      ),
    [appliedFilters],
  );

  const fetchVacancies = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));

    if (appliedFilters.query.trim()) {
      params.set("query", appliedFilters.query.trim());
    }

    if (appliedFilters.status) {
      params.set("status", appliedFilters.status);
    }

    if (appliedFilters.companyId) {
      params.set("companyId", appliedFilters.companyId);
    }

    if (appliedFilters.employmentType) {
      params.set("employmentType", appliedFilters.employmentType);
    }

    if (appliedFilters.status === "closed") {
      params.set("includeArchived", "true");
    }

    try {
      const response = await fetch(`/api/vacancies?${params.toString()}`);

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Er ging iets mis. Probeer het opnieuw.");
      }

      const payload = (await response.json()) as {
        vacancies: VacancyListItem[];
        total: number;
      };

      setVacancies(payload.vacancies);
      setTotal(payload.total);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Er ging iets mis. Probeer het opnieuw.";
      setErrorMessage(message);
      setVacancies([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  }, [appliedFilters, offset]);

  useEffect(() => {
    void fetchVacancies();
  }, [fetchVacancies]);

  function handleApplyFilters() {
    setOffset(0);
    setAppliedFilters(filters);
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setOffset(0);
  }

  const canGoPrev = offset > 0;
  const canGoNext = offset + limit < total;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Beheer open rollen per bedrijf: zoeken, filteren, aanmaken en archiveren."
        actions={
          <Link
            href="/vacancies/new"
            className={buttonVariants({ variant: "default" })}
          >
            Nieuwe vacature
          </Link>
        }
      />

      <VacanciesFilters
        filters={filters}
        companies={companies}
        onChange={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        isLoading={isLoading}
      />

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : vacancies.length === 0 ? (
        <VacancyEmptyState hasFilters={hasActiveFilters} />
      ) : (
        <>
          <VacanciesTable vacancies={vacancies} />
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {total} vacature{total === 1 ? "" : "s"} · toon {offset + 1}–
              {Math.min(offset + limit, total)}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canGoPrev}
                onClick={() => setOffset((value) => Math.max(0, value - limit))}
              >
                Vorige
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canGoNext || hasActiveFilters}
                onClick={() => setOffset((value) => value + limit)}
              >
                Volgende
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
