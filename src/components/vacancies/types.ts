import type { EmploymentType, VacancyStatus } from "@/features/vacancies/domain";

export type VacancyListItem = {
  id: string;
  companyId: string;
  companyName: string;
  title: string;
  location: string | null;
  employmentType: EmploymentType;
  salaryMin: number | null;
  salaryMax: number | null;
  status: VacancyStatus;
  updatedAt: string;
};

export type CompanyOption = {
  id: string;
  name: string;
};

export type VacancyFormValues = {
  companyId: string;
  title: string;
  description?: string;
  location?: string;
  employmentType: EmploymentType;
  salaryMin?: string;
  salaryMax?: string;
  requirements?: string;
  status: VacancyStatus;
};

export type VacancyDetail = {
  id: string;
  companyId: string;
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
  companyName: string;
};
