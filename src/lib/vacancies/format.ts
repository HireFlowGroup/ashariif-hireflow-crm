import type { EmploymentType, VacancyStatus } from "@/features/vacancies/domain";

const employmentTypeLabels: Record<EmploymentType, string> = {
  full_time: "Fulltime",
  part_time: "Parttime",
  contract: "Contract",
  temporary: "Tijdelijk",
};

const statusLabels: Record<VacancyStatus, string> = {
  draft: "Concept",
  open: "Open",
  on_hold: "On hold",
  closed: "Gesloten",
};

export function formatEmploymentType(type: EmploymentType): string {
  return employmentTypeLabels[type];
}

export function formatVacancyStatus(status: VacancyStatus): string {
  return statusLabels[status];
}

export function formatSalaryRange(
  salaryMin: number | null,
  salaryMax: number | null,
): string {
  const formatter = new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });

  if (salaryMin != null && salaryMax != null) {
    return `${formatter.format(salaryMin)} – ${formatter.format(salaryMax)}`;
  }

  if (salaryMin != null) {
    return `vanaf ${formatter.format(salaryMin)}`;
  }

  if (salaryMax != null) {
    return `tot ${formatter.format(salaryMax)}`;
  }

  return "—";
}

export function formatDateTimeNl(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function serializeVacancy(vacancy: {
  id: string;
  organizationId: string;
  companyId: string;
  ownerId: string | null;
  title: string;
  description: string | null;
  location: string | null;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  status: VacancyStatus;
  requirements: string | null;
  createdAt: string;
  updatedAt: string;
}) {
  return {
    ...vacancy,
    id: vacancy.id as string,
    companyId: vacancy.companyId as string,
  };
}
