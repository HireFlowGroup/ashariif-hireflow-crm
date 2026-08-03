export type {
  ArchiveVacancyInput,
  CreateVacancyInput,
  EmploymentType,
  ListVacanciesInput,
  ListVacanciesResult,
  SearchVacanciesInput,
  UpdateVacancyInput,
  Vacancy,
  VacancyId,
  VacancyStatus,
} from "./domain";
export { toVacancyId } from "./domain";

export type { VacanciesRepository } from "./repositories";
export { SupabaseVacanciesRepository } from "./repositories";

export { VacanciesService, type VacanciesServiceContext } from "./services";

export {
  archiveVacancyInputSchema,
  createVacancyInputSchema,
  getVacancyInputSchema,
  listVacanciesInputSchema,
  searchVacanciesInputSchema,
  updateVacancyInputSchema,
} from "./validation";

export { createVacanciesService } from "./create-vacancies-service";
