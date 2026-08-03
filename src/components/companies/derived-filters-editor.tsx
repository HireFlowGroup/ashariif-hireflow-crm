"use client";

import { Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmployeeCountRange } from "@/features/company-finder/domain";
import { HIRING_SIGNAL_TYPES } from "@/features/hiring-intelligence/domain/signal-types";
import type { DerivedSearchFilters, FilterExtractionSource } from "@/features/intelligent-search";
import {
  INTELLIGENT_SEARCH_PROVIDER_OPTIONS,
} from "@/features/intelligent-search";
import { SECTOR_OPTIONS } from "@/features/lead-intelligence/domain";

const EMPLOYEE_COUNT_OPTIONS: Array<{ value: EmployeeCountRange; label: string }> = [
  { value: "1-10", label: "1–10" },
  { value: "11-50", label: "11–50" },
  { value: "51-200", label: "51–200" },
  { value: "201-1000", label: "201–1000" },
  { value: "1000+", label: "1000+" },
];

type DerivedFiltersEditorProps = {
  filters: DerivedSearchFilters;
  onChange: (filters: DerivedSearchFilters) => void;
  disabled?: boolean;
};

function SourceBadge({ source }: { source?: FilterExtractionSource }) {
  if (!source || source === "none") return null;

  return (
    <Badge variant={source === "explicit" ? "default" : "secondary"} className="ml-1">
      {source === "explicit" ? "expliciet" : "afgeleid"}
    </Badge>
  );
}

function FilterRow({
  label,
  source,
  children,
}: {
  label: string;
  source?: FilterExtractionSource;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="flex items-center text-xs text-muted-foreground">
        {label}
        <SourceBadge source={source} />
      </Label>
      {children}
    </div>
  );
}

export function DerivedFiltersEditor({
  filters,
  onChange,
  disabled = false,
}: DerivedFiltersEditorProps) {
  function update(partial: Partial<DerivedSearchFilters>) {
    onChange({ ...filters, ...partial });
  }

  function addVacancyTitle(title: string) {
    const trimmed = title.trim();
    if (!trimmed || filters.vacancyTitles.includes(trimmed)) return;
    update({ vacancyTitles: [...filters.vacancyTitles, trimmed] });
  }

  function removeVacancyTitle(title: string) {
    update({ vacancyTitles: filters.vacancyTitles.filter((entry) => entry !== title) });
  }

  function toggleHiringSignal(slug: string) {
    const current = filters.hiringSignalTypes;
    update({
      hiringSignalTypes: current.includes(slug as DerivedSearchFilters["hiringSignalTypes"][number])
        ? current.filter((entry) => entry !== slug)
        : [...current, slug as DerivedSearchFilters["hiringSignalTypes"][number]],
    });
  }

  function toggleProvider(id: string) {
    const current = filters.providerIds;
    update({
      providerIds: current.includes(id as DerivedSearchFilters["providerIds"][number])
        ? current.filter((entry) => entry !== id)
        : [...current, id as DerivedSearchFilters["providerIds"][number]],
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-muted/20 p-4">
      <div className="flex items-start gap-2 text-sm">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">{filters.reasoning}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <FilterRow label="Plaats" source={filters.fieldSources.city}>
          <Input
            value={filters.city ?? ""}
            onChange={(event) => update({ city: event.target.value || null })}
            placeholder="Niet ingevuld"
            disabled={disabled}
          />
        </FilterRow>

        <FilterRow label="Regio" source={filters.fieldSources.region}>
          <Input
            value={filters.region ?? ""}
            onChange={(event) => update({ region: event.target.value || null })}
            placeholder="Niet ingevuld"
            disabled={disabled}
          />
        </FilterRow>

        <FilterRow label="Branche" source={filters.fieldSources.sector}>
          <select
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            value={filters.sector ?? ""}
            onChange={(event) => update({ sector: event.target.value || null })}
            disabled={disabled}
          >
            <option value="">Niet ingevuld</option>
            {SECTOR_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </FilterRow>

        <FilterRow label="Bedrijfsomvang" source={filters.fieldSources.employeeCountRange}>
          <select
            className="flex h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm"
            value={filters.employeeCountRange ?? ""}
            onChange={(event) =>
              update({
                employeeCountRange: (event.target.value || null) as EmployeeCountRange | null,
              })
            }
            disabled={disabled}
          >
            <option value="">Niet ingevuld</option>
            {EMPLOYEE_COUNT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} medewerkers
              </option>
            ))}
          </select>
        </FilterRow>

        <FilterRow label="Zoekwoorden" source={filters.fieldSources.keywords}>
          <Input
            value={filters.keywords ?? ""}
            onChange={(event) => update({ keywords: event.target.value || null })}
            placeholder="Niet ingevuld"
            disabled={disabled}
            className="sm:col-span-2"
          />
        </FilterRow>

        <FilterRow label="Max. resultaten" source={filters.fieldSources.maxResults}>
          <Input
            type="number"
            min={5}
            max={100}
            value={filters.maxResults ?? 30}
            onChange={(event) =>
              update({ maxResults: Number(event.target.value) || null })
            }
            disabled={disabled}
          />
        </FilterRow>
      </div>

      <FilterRow label="Vacaturetitels" source={filters.fieldSources.vacancyTitles}>
        <div className="flex flex-wrap gap-1.5">
          {filters.vacancyTitles.map((title) => (
            <Badge key={title} variant="outline" className="gap-1 pr-1">
              {title}
              {!disabled ? (
                <button
                  type="button"
                  onClick={() => removeVacancyTitle(title)}
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label={`Verwijder ${title}`}
                >
                  <X className="size-3" />
                </button>
              ) : null}
            </Badge>
          ))}
          {!disabled ? (
            <Input
              className="h-7 w-40 text-xs"
              placeholder="+ rol toevoegen"
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addVacancyTitle((event.target as HTMLInputElement).value);
                  (event.target as HTMLInputElement).value = "";
                }
              }}
            />
          ) : null}
          {filters.vacancyTitles.length === 0 ? (
            <span className="text-xs text-muted-foreground">Geen vacaturetitels</span>
          ) : null}
        </div>
      </FilterRow>

      <FilterRow label="Hiring signals" source={filters.fieldSources.hiringSignalTypes}>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(HIRING_SIGNAL_TYPES).map(([slug, meta]) => {
            const active = filters.hiringSignalTypes.includes(
              slug as DerivedSearchFilters["hiringSignalTypes"][number],
            );

            return (
              <button
                key={slug}
                type="button"
                disabled={disabled}
                onClick={() => toggleHiringSignal(slug)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {meta.label}
              </button>
            );
          })}
        </div>
      </FilterRow>

      <FilterRow label="Providers" source={filters.fieldSources.providerIds}>
        <div className="flex flex-wrap gap-1.5">
          {INTELLIGENT_SEARCH_PROVIDER_OPTIONS.map((provider) => {
            const active = filters.providerIds.includes(provider.id);

            return (
              <button
                key={provider.id}
                type="button"
                disabled={disabled}
                title={provider.description}
                onClick={() => toggleProvider(provider.id)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {provider.label}
              </button>
            );
          })}
          {filters.providerIds.length === 0 ? (
            <span className="text-xs text-muted-foreground">Alle actieve providers</span>
          ) : null}
        </div>
      </FilterRow>

      <div className="flex items-center gap-2">
        <input
          id="derived-search-vacancies"
          type="checkbox"
          checked={filters.searchVacancies ?? true}
          onChange={(event) => update({ searchVacancies: event.target.checked })}
          disabled={disabled}
        />
        <Label htmlFor="derived-search-vacancies" className="text-sm font-normal">
          Zoek ook naar vacatures
        </Label>
        <SourceBadge source={filters.fieldSources.searchVacancies} />
      </div>
    </div>
  );
}
