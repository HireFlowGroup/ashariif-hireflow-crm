import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { VacancyListItem } from "@/components/vacancies/types";
import { VacancyStatusBadge } from "@/components/vacancies/vacancy-status-badge";
import {
  formatDateTimeNl,
  formatEmploymentType,
  formatSalaryRange,
} from "@/lib/vacancies/format";

type VacanciesTableProps = {
  vacancies: VacancyListItem[];
};

export function VacanciesTable({ vacancies }: VacanciesTableProps) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Functietitel</th>
            <th className="px-4 py-3 font-medium">Bedrijf</th>
            <th className="px-4 py-3 font-medium">Locatie</th>
            <th className="px-4 py-3 font-medium">Dienstverband</th>
            <th className="px-4 py-3 font-medium">Salaris</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Bijgewerkt</th>
            <th className="px-4 py-3 font-medium">Actie</th>
          </tr>
        </thead>
        <tbody>
          {vacancies.map((vacancy) => (
            <tr key={vacancy.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium">{vacancy.title}</td>
              <td className="px-4 py-3">{vacancy.companyName}</td>
              <td className="px-4 py-3">{vacancy.location ?? "—"}</td>
              <td className="px-4 py-3">{formatEmploymentType(vacancy.employmentType)}</td>
              <td className="px-4 py-3">
                {formatSalaryRange(vacancy.salaryMin, vacancy.salaryMax)}
              </td>
              <td className="px-4 py-3">
                <VacancyStatusBadge status={vacancy.status} />
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {formatDateTimeNl(vacancy.updatedAt)}
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/vacancies/${vacancy.id}`}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  Openen
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
