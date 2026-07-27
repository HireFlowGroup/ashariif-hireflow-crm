import type { Company, CompanyId } from "@/features/companies/domain";
import type { CompaniesRepository } from "@/features/companies/repositories";

export type CompaniesServiceContext = {
  organizationId: string;
  userId: string;
};

/** Application service for company use cases (validation + orchestration). */
export class CompaniesService {
  constructor(private readonly repository: CompaniesRepository) {}

  async createCompany(
    ...args: [CompaniesServiceContext, Parameters<CompaniesRepository["create"]>[1]]
  ): Promise<Company> {
    void args;
    void this.repository;
    throw new Error("Not implemented");
  }

  async updateCompany(
    ...args: [CompaniesServiceContext, CompanyId, Parameters<CompaniesRepository["update"]>[2]]
  ): Promise<Company> {
    void args;
    void this.repository;
    throw new Error("Not implemented");
  }

  async findCompany(
    ...args: [CompaniesServiceContext, CompanyId]
  ): Promise<Company | null> {
    void args;
    void this.repository;
    throw new Error("Not implemented");
  }

  async searchCompanies(
    ...args: [CompaniesServiceContext, Parameters<CompaniesRepository["search"]>[1]]
  ): Promise<Company[]> {
    void args;
    void this.repository;
    throw new Error("Not implemented");
  }

  async archiveCompany(
    ...args: [CompaniesServiceContext, CompanyId]
  ): Promise<Company> {
    void args;
    void this.repository;
    throw new Error("Not implemented");
  }
}
