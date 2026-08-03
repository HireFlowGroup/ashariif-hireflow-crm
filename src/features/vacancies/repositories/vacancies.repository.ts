import type {
  ListVacanciesInput,
  ListVacanciesResult,
  SearchVacanciesInput,
  Vacancy,
  VacancyId,
} from "@/features/vacancies/domain";
import type { CreateVacancyInput, UpdateVacancyInput } from "@/features/vacancies/domain";

/** Persistence contract for vacancies (no business rules). */
export interface VacanciesRepository {
  create(organizationId: string, input: CreateVacancyInput): Promise<Vacancy>;

  update(
    organizationId: string,
    vacancyId: VacancyId,
    input: UpdateVacancyInput,
  ): Promise<Vacancy>;

  findById(organizationId: string, vacancyId: VacancyId): Promise<Vacancy | null>;

  search(organizationId: string, input: SearchVacanciesInput): Promise<Vacancy[]>;

  list(organizationId: string, input: ListVacanciesInput): Promise<ListVacanciesResult>;

  archive(organizationId: string, vacancyId: VacancyId): Promise<Vacancy>;
}
