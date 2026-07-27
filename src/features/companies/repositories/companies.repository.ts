import type {
  Company,
  CompanyId,
  CreateCompanyInput,
  SearchCompaniesInput,
  UpdateCompanyInput,
} from "@/features/companies/domain";

/** Persistence contract for companies (no business rules). */
export interface CompaniesRepository {
  create(
    organizationId: string,
    input: CreateCompanyInput,
  ): Promise<Company>;

  update(
    organizationId: string,
    companyId: CompanyId,
    input: UpdateCompanyInput,
  ): Promise<Company>;

  findById(organizationId: string, companyId: CompanyId): Promise<Company | null>;

  search(organizationId: string, input: SearchCompaniesInput): Promise<Company[]>;

  archive(organizationId: string, companyId: CompanyId): Promise<Company>;
}
