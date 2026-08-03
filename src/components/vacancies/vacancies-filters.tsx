"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { CompanyOption } from "@/components/vacancies/types";
import type { EmploymentType, VacancyStatus } from "@/features/vacancies/domain";

export type VacanciesFilterState = {
  query: string;
  status: VacancyStatus | "";
  companyId: string;
  employmentType: EmploymentType | "";
};

type VacanciesFiltersProps = {
  filters: VacanciesFilterState;
  companies: CompanyOption[];
  onChange: (filters: VacanciesFilterState) => void;
  onApply: () => void;
  onReset: () => void;
  isLoading?: boolean;
};

export function VacanciesFilters({
  filters,
  companies,
  onChange,
  onApply,
  onReset,
  isLoading = false,
}: VacanciesFiltersProps) {
  return (
    <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-2 lg:col-span-2">
        <Label htmlFor="vacancy-search">Zoeken</Label>
        <Input
          id="vacancy-search"
          placeholder="Titel, omschrijving, locatie…"
          value={filters.query}
          onChange={(event) =>
            onChange({ ...filters, query: event.target.value })
          }
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onApply();
            }
          }}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vacancy-status">Status</Label>
        <select
          id="vacancy-status"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          value={filters.status}
          onChange={(event) =>
            onChange({
              ...filters,
              status: event.target.value as VacanciesFilterState["status"],
            })
          }
        >
          <option value="">Alle statussen</option>
          <option value="draft">Concept</option>
          <option value="open">Open</option>
          <option value="on_hold">On hold</option>
          <option value="closed">Gesloten</option>
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vacancy-company">Bedrijf</Label>
        <select
          id="vacancy-company"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          value={filters.companyId}
          onChange={(event) =>
            onChange({ ...filters, companyId: event.target.value })
          }
        >
          <option value="">Alle bedrijven</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vacancy-employment">Dienstverband</Label>
        <select
          id="vacancy-employment"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
          value={filters.employmentType}
          onChange={(event) =>
            onChange({
              ...filters,
              employmentType: event.target.value as VacanciesFilterState["employmentType"],
            })
          }
        >
          <option value="">Alle typen</option>
          <option value="full_time">Fulltime</option>
          <option value="part_time">Parttime</option>
          <option value="contract">Contract</option>
          <option value="temporary">Tijdelijk</option>
        </select>
      </div>
      <div className="flex items-end gap-2 md:col-span-2 lg:col-span-5">
        <Button type="button" onClick={onApply} disabled={isLoading}>
          Toepassen
        </Button>
        <Button type="button" variant="outline" onClick={onReset} disabled={isLoading}>
          Reset
        </Button>
      </div>
    </div>
  );
}
