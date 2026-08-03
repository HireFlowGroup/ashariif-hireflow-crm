import { PageHeader } from "@/components/layout/page-header";
import { CompaniesTable } from "@/components/companies/companies-table";
import { CompanyEmptyState } from "@/components/companies/company-empty-state";
import type { CompanyListItem } from "@/components/companies/types";

type CompaniesOverviewProps = {
  companies: CompanyListItem[];
  total: number;
  errorMessage: string | null;
};

export function CompaniesOverview({
  companies,
  total,
  errorMessage,
}: CompaniesOverviewProps) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Bedrijven"
        description="Beheer klantorganisaties, accountstatus en samenwerkingen binnen je organisatie."
      />

      {errorMessage ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {!errorMessage && companies.length === 0 ? (
        <CompanyEmptyState />
      ) : null}

      {!errorMessage && companies.length > 0 ? (
        <>
          <CompaniesTable
            companies={companies}
            onFindContacts={() => undefined}
            findingContactsCompanyId={null}
            onQueueOutreach={() => undefined}
            onArchive={() => undefined}
            queueingOutreachCompanyId={null}
          />
          <p className="text-sm text-muted-foreground">
            {total} bedrijf{total === 1 ? "" : "ven"} in totaal
          </p>
        </>
      ) : null}
    </div>
  );
}
