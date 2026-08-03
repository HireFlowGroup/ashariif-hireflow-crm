"use client";

import Link from "next/link";
import { Archive, Briefcase, Eye, Mail, Users } from "lucide-react";
import type { CompanyListItem } from "@/components/companies/types";
import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { useContextMenu } from "@/components/ui/context-menu-provider";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatLeadPriority, formatLeadScore } from "@/lib/companies/format";

type CompaniesTableProps = {
  companies: CompanyListItem[];
  onFindContacts: (company: CompanyListItem) => void;
  findingContactsCompanyId: string | null;
  onQueueOutreach: (company: CompanyListItem) => void;
  onArchive: (company: CompanyListItem) => void;
  queueingOutreachCompanyId: string | null;
};

export function CompaniesTable({
  companies,
  onFindContacts,
  findingContactsCompanyId,
  onQueueOutreach,
  onArchive,
  queueingOutreachCompanyId,
}: CompaniesTableProps) {
  const { openMenu } = useContextMenu();

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[1200px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Naam</th>
            <th className="px-4 py-3 font-medium">Plaats</th>
            <th className="px-4 py-3 font-medium">Sector</th>
            <th className="px-4 py-3 font-medium">Score</th>
            <th className="px-4 py-3 font-medium">Prioriteit</th>
            <th className="px-4 py-3 font-medium">Vacatures</th>
            <th className="px-4 py-3 font-medium">Contacten</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Acties</th>
          </tr>
        </thead>
        <tbody>
          {companies.map((company) => {
            const isFinding = findingContactsCompanyId === company.id;
            const isQueueing = queueingOutreachCompanyId === company.id;

            return (
              <tr
                key={company.id}
                className="border-b last:border-b-0"
                onContextMenu={(event) =>
                  openMenu(event, [
                    {
                      id: "open",
                      label: "Open bedrijf",
                      onSelect: () => {
                        window.location.href = `/companies/${company.id}`;
                      },
                    },
                    {
                      id: "outreach",
                      label: "Queue outreach",
                      onSelect: () => onQueueOutreach(company),
                    },
                    {
                      id: "contacts",
                      label: "Zoek contacten",
                      onSelect: () => onFindContacts(company),
                    },
                    {
                      id: "archive",
                      label: "Archiveer",
                      destructive: true,
                      onSelect: () => onArchive(company),
                    },
                  ])
                }
              >
                <td className="px-4 py-3 font-medium">
                  <Link
                    href={`/companies/${company.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {company.name}
                  </Link>
                  {company.scoreReason ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{company.scoreReason}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">{company.city ?? "—"}</td>
                <td className="px-4 py-3">{company.sector ?? "—"}</td>
                <td className="px-4 py-3">{formatLeadScore(company.leadScore)}</td>
                <td className="px-4 py-3">
                  {company.leadPriority ? (
                    <span
                      className={
                        company.leadPriority === "A"
                          ? "font-semibold text-emerald-600"
                          : company.leadPriority === "B"
                            ? "font-medium text-sky-600"
                            : company.leadPriority === "C"
                              ? "font-medium text-amber-600"
                              : "text-muted-foreground"
                      }
                    >
                      {formatLeadPriority(company.leadPriority)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">{company.vacancyCount > 0 ? company.vacancyCount : "—"}</td>
                <td className="px-4 py-3">{company.contactCount}</td>
                <td className="px-4 py-3">
                  <CompanyStatusBadge status={company.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <Link
                      href={`/companies/${company.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                    >
                      <Eye className="size-4" />
                      Bekijk
                    </Link>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isFinding}
                      onClick={() => onFindContacts(company)}
                    >
                      <Users className="size-4" />
                      Contacten
                    </Button>
                    {company.vacancyCount > 0 ? (
                      <Link
                        href={`/companies/${company.id}#vacatures`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                      >
                        <Briefcase className="size-4" />
                        Vacatures
                      </Link>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isQueueing || (company.leadScore ?? 0) < 50}
                      onClick={() => onQueueOutreach(company)}
                    >
                      <Mail className="size-4" />
                      Outreach
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onArchive(company)}
                    >
                      <Archive className="size-4" />
                      Archiveren
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
