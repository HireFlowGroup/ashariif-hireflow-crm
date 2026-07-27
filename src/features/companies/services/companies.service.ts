import type {
  Company,
  CompanyId,
  CreateCompanyInput,
  SearchCompaniesInput,
  UpdateCompanyInput,
} from "@/features/companies/domain";
import type { CompaniesRepository } from "@/features/companies/repositories";
import { CompaniesValidationError } from "@/features/companies/services/errors";
import {
  composeCompanyNotes,
  normalizeCreateCompanyInput,
} from "@/features/companies/services/normalize-company-input";
import { createCompanyInputSchema } from "@/features/companies/validation";

export type CompaniesServiceContext = {
  organizationId: string;
  userId: string;
};

/** Application service for company use cases (validation + orchestration). */
export class CompaniesService {
  constructor(private readonly repository: CompaniesRepository) {}

  async createCompany(
    context: CompaniesServiceContext,
    input: CreateCompanyInput,
  ): Promise<Company> {
    const normalized = normalizeCreateCompanyInput(input);

    if (!normalized.name) {
      throw new CompaniesValidationError("Bedrijfsnaam is verplicht.");
    }

    const parsed = createCompanyInputSchema.safeParse(normalized);

    if (!parsed.success) {
      throw new CompaniesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige bedrijfsinvoer.",
      );
    }

    const persistedInput: CreateCompanyInput = {
      name: parsed.data.name,
      ownerId: context.userId,
      website: parsed.data.website ?? null,
      sector: parsed.data.sector ?? null,
      city: parsed.data.city ?? null,
      status: parsed.data.status ?? "prospect",
      notes: parsed.data.notes ?? null,
      employeeCount: parsed.data.employeeCount ?? null,
      priority: parsed.data.priority ?? null,
    };

    const company = await this.repository.create(context.organizationId, persistedInput);

    const composedNotes = composeCompanyNotes({
      notes: parsed.data.notes,
      email: parsed.data.email,
      phone: parsed.data.phone,
    });

    if (!composedNotes) {
      return company;
    }

    return {
      ...company,
      notes: composedNotes,
      city: parsed.data.city ?? company.city,
    };
  }

  async updateCompany(
    ...args: [CompaniesServiceContext, CompanyId, UpdateCompanyInput]
  ): Promise<Company> {
    void args;
    throw new Error("Not implemented");
  }

  async findCompany(
    ...args: [CompaniesServiceContext, CompanyId]
  ): Promise<Company | null> {
    void args;
    throw new Error("Not implemented");
  }

  async searchCompanies(
    ...args: [CompaniesServiceContext, SearchCompaniesInput]
  ): Promise<Company[]> {
    void args;
    throw new Error("Not implemented");
  }

  async archiveCompany(
    ...args: [CompaniesServiceContext, CompanyId]
  ): Promise<Company> {
    void args;
    throw new Error("Not implemented");
  }
}
