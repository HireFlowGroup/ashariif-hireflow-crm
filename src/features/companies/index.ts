export type {
  Company,
  CompanyId,
  CompanyPriority,
  CompanyStatus,
  CreateCompanyInput,
  SearchCompaniesInput,
  UpdateCompanyInput,
} from "./domain";
export { toCompanyId } from "./domain";

export type { CompaniesRepository } from "./repositories";
export { SupabaseCompaniesRepository } from "./repositories";

export { CompaniesService, type CompaniesServiceContext } from "./services";

export {
  createCompanyInputSchema,
  searchCompaniesInputSchema,
  updateCompanyInputSchema,
} from "./validation";
