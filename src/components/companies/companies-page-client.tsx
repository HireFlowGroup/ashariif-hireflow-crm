"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { WorkspacePage } from "@/components/layout/workspace-page";
import { Button } from "@/components/ui/button";
import { CompaniesTable } from "@/components/companies/companies-table";
import { CompanyEmptyState } from "@/components/companies/company-empty-state";
import { CompanyFinderDialog } from "@/components/companies/company-finder-dialog";
import { ContactFinderDialog } from "@/components/companies/contact-finder-dialog";
import type { CompanyListFilters, CompanyListItem } from "@/components/companies/types";

type CompaniesPageClientProps = {
  companies: CompanyListItem[];
  total: number;
  errorMessage: string | null;
  initialFilters: CompanyListFilters;
};

export function CompaniesPageClient({
  companies,
  total,
  errorMessage,
  initialFilters,
}: CompaniesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [finderOpen, setFinderOpen] = useState(false);
  const [contactFinderCompany, setContactFinderCompany] = useState<CompanyListItem | null>(null);
  const [findingContactsCompanyId, setFindingContactsCompanyId] = useState<string | null>(null);
  const [queueingOutreachCompanyId, setQueueingOutreachCompanyId] = useState<string | null>(null);
  const [filters, setFilters] = useState<CompanyListFilters>(initialFilters);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("finder") === "1") {
      setFinderOpen(true);
    }
  }, [searchParams]);

  function applyFilters(next: CompanyListFilters) {
    setFilters(next);
    const params = new URLSearchParams();

    if (next.leadPriority) params.set("priority", next.leadPriority);
    if (next.hasVacancies) params.set("vacancies", "1");
    if (next.outreachReady) params.set("outreach", "1");

    const query = params.toString();
    router.push(query ? `/companies?${query}` : "/companies");
  }

  function handleFinderCompleted() {
    router.refresh();
  }

  async function handleQueueOutreach(company: CompanyListItem) {
    setQueueingOutreachCompanyId(company.id);
    setActionMessage(null);

    try {
      const response = await fetch("/api/outreach/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: company.id }),
      });

      const payload = (await response.json()) as { error?: string; message?: { id: string } };

      if (!response.ok) {
        throw new Error(payload.error ?? "Outreach-concept kon niet worden aangemaakt.");
      }

      setActionMessage(`${company.name}: concept aangemaakt — ga naar Outreach om te reviewen.`);
      router.refresh();
    } catch (error) {
      setActionMessage(
        error instanceof Error ? error.message : "Outreach kon niet worden voorbereid.",
      );
    } finally {
      setQueueingOutreachCompanyId(null);
    }
  }

  async function handleArchive(company: CompanyListItem) {
    setActionMessage(null);

    try {
      const response = await fetch(`/api/companies/${company.id}/archive`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Handmatig gearchiveerd" }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Archiveren mislukt.");
      }

      setActionMessage(`${company.name} is gearchiveerd.`);
      router.refresh();
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : "Archiveren mislukt.");
    }
  }

  return (
    <WorkspacePage
      title="Companies"
      description="Hiring intelligence per bedrijf — geen traditionele CRM."
      actions={
        <Button type="button" onClick={() => setFinderOpen(true)}>
          <Search className="size-4" />
          AI zoeken
        </Button>
      }
    >
      <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["A", "B", "C", "D"] as const).map((priority) => (
          <Button
            key={priority}
            type="button"
            size="sm"
            variant={filters.leadPriority === priority ? "default" : "outline"}
            onClick={() =>
              applyFilters({
                ...filters,
                leadPriority: filters.leadPriority === priority ? undefined : priority,
              })
            }
          >
            Prioriteit {priority}
          </Button>
        ))}
        <Button
          type="button"
          size="sm"
          variant={filters.hasVacancies ? "default" : "outline"}
          onClick={() =>
            applyFilters({ ...filters, hasVacancies: !filters.hasVacancies })
          }
        >
          Met actuele vacatures
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filters.outreachReady ? "default" : "outline"}
          onClick={() =>
            applyFilters({ ...filters, outreachReady: !filters.outreachReady })
          }
        >
          Klaar voor outreach
        </Button>
      </div>

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {actionMessage ? (
        <p className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          {actionMessage}
        </p>
      ) : null}

      {!errorMessage && companies.length === 0 ? <CompanyEmptyState /> : null}

      {!errorMessage && companies.length > 0 ? (
        <>
          <CompaniesTable
            companies={companies}
            onFindContacts={(company) => {
              setContactFinderCompany(company);
              setFindingContactsCompanyId(company.id);
            }}
            findingContactsCompanyId={findingContactsCompanyId}
            onQueueOutreach={handleQueueOutreach}
            onArchive={handleArchive}
            queueingOutreachCompanyId={queueingOutreachCompanyId}
          />
          <p className="text-sm text-muted-foreground">
            {total} bedrijf{total === 1 ? "" : "ven"} in totaal
          </p>
        </>
      ) : null}

      <CompanyFinderDialog
        open={finderOpen}
        onOpenChange={setFinderOpen}
        onCompleted={handleFinderCompleted}
      />

      <ContactFinderDialog
        open={contactFinderCompany !== null}
        companyId={contactFinderCompany?.id ?? null}
        companyName={contactFinderCompany?.name ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setContactFinderCompany(null);
            setFindingContactsCompanyId(null);
          }
        }}
        onCompleted={() => {
          setFindingContactsCompanyId(null);
          router.refresh();
        }}
      />
      </div>
    </WorkspacePage>
  );
}
