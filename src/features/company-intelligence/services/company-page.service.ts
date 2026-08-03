import type { CompanyPageData } from "@/features/company-intelligence/domain/company-page.types";
import type { CompanyPageRepository } from "@/features/company-intelligence/repositories/company-page.repository";

export type CompanyPageServiceContext = {
  organizationId: string;
  userId: string;
};

export class CompanyPageService {
  constructor(private readonly repository: CompanyPageRepository) {}

  async getPageData(
    context: CompanyPageServiceContext,
    companyId: string,
  ): Promise<CompanyPageData | null> {
    return this.repository.loadPageData(context.organizationId, companyId);
  }
}
