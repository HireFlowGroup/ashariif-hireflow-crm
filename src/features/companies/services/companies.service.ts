import type {
  ArchiveCompanyInput,
  Company,
  CompanyId,
  CreateCompanyInput,
  DeleteCompanyInput,
  ListCompaniesInput,
  ListCompaniesResult,
  SearchCompaniesInput,
  UpdateCompanyInput,
} from "@/features/companies/domain";
import type { CompaniesRepository } from "@/features/companies/repositories";
import { CompaniesValidationError } from "@/features/companies/services/errors";
import {
  composeCompanyNotes,
  normalizeCreateCompanyInput,
  normalizeUpdateCompanyInput,
} from "@/features/companies/services/normalize-company-input";
import {
  archiveCompanyInputSchema,
  createCompanyInputSchema,
  deleteCompanyInputSchema,
  getCompanyInputSchema,
  listCompaniesInputSchema,
  searchCompaniesInputSchema,
  updateCompanyInputSchema,
} from "@/features/companies/validation";

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
    context: CompaniesServiceContext,
    companyId: CompanyId,
    input: UpdateCompanyInput,
  ): Promise<Company> {
    const normalized = normalizeUpdateCompanyInput(input);

    const parsed = updateCompanyInputSchema.safeParse(normalized);

    if (!parsed.success) {
      throw new CompaniesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige update-invoer.",
      );
    }

    const existing = await this.repository.findById(context.organizationId, companyId);

    if (!existing) {
      throw new CompaniesValidationError("Bedrijf niet gevonden.");
    }

    const persistedInput: UpdateCompanyInput = {};

    if (parsed.data.name !== undefined) {
      persistedInput.name = parsed.data.name;
    }

    if (parsed.data.website !== undefined) {
      persistedInput.website = parsed.data.website;
    }

    if (parsed.data.sector !== undefined) {
      persistedInput.sector = parsed.data.sector;
    }

    if (parsed.data.status !== undefined) {
      persistedInput.status = parsed.data.status;
    }

    const updated = await this.repository.update(
      context.organizationId,
      companyId,
      persistedInput,
    );

    const composedNotes = composeCompanyNotes({
      notes: parsed.data.notes ?? existing.notes,
      email: parsed.data.email,
      phone: parsed.data.phone,
    });

    return {
      ...updated,
      ownerId: existing.ownerId,
      notes: composedNotes ?? updated.notes,
      city: parsed.data.city ?? existing.city,
    };
  }

  async getCompany(
    context: CompaniesServiceContext,
    companyId: CompanyId,
  ): Promise<Company> {
    const parsed = getCompanyInputSchema.safeParse({
      companyId: companyId as string,
    });

    if (!parsed.success) {
      throw new CompaniesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige bedrijfsinvoer.",
      );
    }

    const company = await this.repository.findById(context.organizationId, companyId);

    if (!company) {
      throw new CompaniesValidationError("Bedrijf niet gevonden.");
    }

    return company;
  }

  async listCompanies(
    context: CompaniesServiceContext,
    input: ListCompaniesInput = {},
  ): Promise<ListCompaniesResult> {
    const parsed = listCompaniesInputSchema.safeParse({
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
      includeArchived: input.includeArchived ?? false,
    });

    if (!parsed.success) {
      throw new CompaniesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige lijst-invoer.",
      );
    }

    return this.repository.list(context.organizationId, parsed.data);
  }

  async searchCompanies(
    context: CompaniesServiceContext,
    input: SearchCompaniesInput,
  ): Promise<Company[]> {
    const parsed = searchCompaniesInputSchema.safeParse({
      ...input,
      query: input.query?.replace(/\s+/g, " ").trim() || undefined,
      city: input.city?.replace(/\s+/g, " ").trim() || undefined,
      sector: input.sector?.replace(/\s+/g, " ").trim() || undefined,
      limit: input.limit ?? 20,
    });

    if (!parsed.success) {
      throw new CompaniesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige zoekopdracht.",
      );
    }

    return this.repository.search(context.organizationId, parsed.data);
  }

  async archiveCompany(
    context: CompaniesServiceContext,
    companyId: CompanyId,
    input: ArchiveCompanyInput = {},
  ): Promise<Company> {
    const parsed = archiveCompanyInputSchema.safeParse({
      companyId: companyId as string,
      reason: input.reason?.replace(/\s+/g, " ").trim() || undefined,
    });

    if (!parsed.success) {
      throw new CompaniesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige archiveringsinvoer.",
      );
    }

    const existing = await this.repository.findById(context.organizationId, companyId);

    if (!existing) {
      throw new CompaniesValidationError("Bedrijf niet gevonden.");
    }

    if (existing.status === "archived" || existing.status === "inactive") {
      throw new CompaniesValidationError("Bedrijf is al gearchiveerd.");
    }

    const archived = await this.repository.archive(context.organizationId, companyId);

    const reason = parsed.data.reason;

    if (!reason) {
      return archived;
    }

    const reasonNote = `Archiveringsreden: ${reason}`;

    return {
      ...archived,
      notes: archived.notes ? `${archived.notes}\n${reasonNote}` : reasonNote,
    };
  }

  async deleteCompany(
    context: CompaniesServiceContext,
    companyId: CompanyId,
    input: DeleteCompanyInput = {},
  ): Promise<Company> {
    const parsed = deleteCompanyInputSchema.safeParse({
      companyId: companyId as string,
      reason: input.reason?.replace(/\s+/g, " ").trim() || undefined,
    });

    if (!parsed.success) {
      throw new CompaniesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige verwijderingsinvoer.",
      );
    }

    const existing = await this.repository.findById(context.organizationId, companyId);

    if (!existing) {
      throw new CompaniesValidationError("Bedrijf niet gevonden.");
    }

    if (existing.status === "archived" || existing.status === "inactive") {
      throw new CompaniesValidationError("Bedrijf is al verwijderd.");
    }

    return this.repository.delete(context.organizationId, companyId);
  }
}
