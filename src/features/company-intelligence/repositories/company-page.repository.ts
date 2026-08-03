import type { CompanyPageData } from "@/features/company-intelligence/domain/company-page.types";

export interface CompanyPageRepository {
  loadPageData(organizationId: string, companyId: string): Promise<CompanyPageData | null>;
}

export class CompanyPageRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CompanyPageRepositoryError";
  }
}
