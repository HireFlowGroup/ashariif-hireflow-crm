import type {
  Company,
  CompanyId,
  CreateCompanyInput,
  ListCompaniesInput,
  ListCompaniesResult,
  SearchCompaniesInput,
  UpdateCompanyInput,
} from "@/features/companies/domain";

/** Persistence contract for companies (no business rules). */
export interface CompaniesRepository {
  create(
    organizationId: string,
    input: CreateCompanyInput,
  ): Promise<Company>;

  createDiscovery(
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

  list(organizationId: string, input: ListCompaniesInput): Promise<ListCompaniesResult>;

  archive(organizationId: string, companyId: CompanyId): Promise<Company>;

  delete(organizationId: string, companyId: CompanyId): Promise<Company>;
}
