import { toCompanyId } from "@/features/companies/domain";
import type {
  ArchiveVacancyInput,
  CreateVacancyInput,
  ListVacanciesInput,
  ListVacanciesResult,
  SearchVacanciesInput,
  UpdateVacancyInput,
  Vacancy,
  VacancyId,
} from "@/features/vacancies/domain";
import type { VacanciesRepository } from "@/features/vacancies/repositories";
import { VacanciesValidationError } from "@/features/vacancies/services/errors";
import {
  assertSalaryRange,
  normalizeCreateVacancyInput,
  normalizeUpdateVacancyInput,
} from "@/features/vacancies/services/normalize-vacancy-input";
import {
  archiveVacancyInputSchema,
  createVacancyInputSchema,
  getVacancyInputSchema,
  listVacanciesInputSchema,
  searchVacanciesInputSchema,
  updateVacancyInputSchema,
} from "@/features/vacancies/validation";

export type VacanciesServiceContext = {
  organizationId: string;
  userId: string;
};

/** Application service for vacancy use cases (validation + orchestration). */
export class VacanciesService {
  constructor(private readonly repository: VacanciesRepository) {}

  async createVacancy(
    context: VacanciesServiceContext,
    input: CreateVacancyInput,
  ): Promise<Vacancy> {
    const normalized = normalizeCreateVacancyInput(input);

    const parsed = createVacancyInputSchema.safeParse({
      ...normalized,
      companyId: normalized.companyId as string,
    });

    if (!parsed.success) {
      throw new VacanciesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige vacature-invoer.",
      );
    }

    const persistedInput: CreateVacancyInput = {
      companyId: toCompanyId(parsed.data.companyId),
      title: parsed.data.title,
      ownerId: parsed.data.ownerId ?? context.userId,
      description: parsed.data.description ?? null,
      location: parsed.data.location ?? null,
      employmentType: parsed.data.employmentType ?? "full_time",
      salaryMin: parsed.data.salaryMin ?? null,
      salaryMax: parsed.data.salaryMax ?? null,
      status: parsed.data.status ?? "draft",
      requirements: parsed.data.requirements ?? null,
    };

    return this.repository.create(context.organizationId, persistedInput);
  }

  async updateVacancy(
    context: VacanciesServiceContext,
    vacancyId: VacancyId,
    input: UpdateVacancyInput,
  ): Promise<Vacancy> {
    const normalized = normalizeUpdateVacancyInput(input);

    const parsed = updateVacancyInputSchema.safeParse({
      ...normalized,
      companyId: normalized.companyId ? (normalized.companyId as string) : undefined,
    });

    if (!parsed.success) {
      throw new VacanciesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige update-invoer.",
      );
    }

    const existing = await this.repository.findById(context.organizationId, vacancyId);

    if (!existing) {
      throw new VacanciesValidationError("Vacature niet gevonden.");
    }

    const nextMin =
      parsed.data.salaryMin !== undefined ? parsed.data.salaryMin : existing.salaryMin;
    const nextMax =
      parsed.data.salaryMax !== undefined ? parsed.data.salaryMax : existing.salaryMax;

    try {
      assertSalaryRange(nextMin, nextMax);
    } catch (error) {
      throw new VacanciesValidationError(
        error instanceof Error
          ? error.message
          : "Ongeldig salarisbereik.",
      );
    }

    const persistedInput: UpdateVacancyInput = {};

    if (parsed.data.companyId !== undefined) {
      persistedInput.companyId = toCompanyId(parsed.data.companyId);
    }

    if (parsed.data.title !== undefined) {
      persistedInput.title = parsed.data.title;
    }

    if (parsed.data.ownerId !== undefined) {
      persistedInput.ownerId = parsed.data.ownerId;
    }

    if (parsed.data.description !== undefined) {
      persistedInput.description = parsed.data.description;
    }

    if (parsed.data.location !== undefined) {
      persistedInput.location = parsed.data.location;
    }

    if (parsed.data.employmentType !== undefined) {
      persistedInput.employmentType = parsed.data.employmentType;
    }

    if (parsed.data.salaryMin !== undefined) {
      persistedInput.salaryMin = parsed.data.salaryMin;
    }

    if (parsed.data.salaryMax !== undefined) {
      persistedInput.salaryMax = parsed.data.salaryMax;
    }

    if (parsed.data.status !== undefined) {
      persistedInput.status = parsed.data.status;
    }

    if (parsed.data.requirements !== undefined) {
      persistedInput.requirements = parsed.data.requirements;
    }

    return this.repository.update(context.organizationId, vacancyId, persistedInput);
  }

  async getVacancy(
    context: VacanciesServiceContext,
    vacancyId: VacancyId,
  ): Promise<Vacancy> {
    const parsed = getVacancyInputSchema.safeParse({
      vacancyId: vacancyId as string,
    });

    if (!parsed.success) {
      throw new VacanciesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige vacature-invoer.",
      );
    }

    const vacancy = await this.repository.findById(context.organizationId, vacancyId);

    if (!vacancy) {
      throw new VacanciesValidationError("Vacature niet gevonden.");
    }

    return vacancy;
  }

  async searchVacancies(
    context: VacanciesServiceContext,
    input: SearchVacanciesInput,
  ): Promise<Vacancy[]> {
    const parsed = searchVacanciesInputSchema.safeParse({
      ...input,
      query: input.query?.replace(/\s+/g, " ").trim() || undefined,
      location: input.location?.replace(/\s+/g, " ").trim() || undefined,
      companyId: input.companyId ? (input.companyId as string) : undefined,
      limit: input.limit ?? 20,
    });

    if (!parsed.success) {
      throw new VacanciesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige zoekopdracht.",
      );
    }

    return this.repository.search(context.organizationId, {
      ...parsed.data,
      companyId: parsed.data.companyId
        ? toCompanyId(parsed.data.companyId)
        : undefined,
    });
  }

  async listVacancies(
    context: VacanciesServiceContext,
    input: ListVacanciesInput = {},
  ): Promise<ListVacanciesResult> {
    const parsed = listVacanciesInputSchema.safeParse({
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
      includeArchived: input.includeArchived ?? false,
      companyId: input.companyId ? (input.companyId as string) : undefined,
    });

    if (!parsed.success) {
      throw new VacanciesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige lijst-invoer.",
      );
    }

    return this.repository.list(context.organizationId, {
      ...parsed.data,
      companyId: parsed.data.companyId
        ? toCompanyId(parsed.data.companyId)
        : undefined,
    });
  }

  async archiveVacancy(
    context: VacanciesServiceContext,
    vacancyId: VacancyId,
    input: ArchiveVacancyInput = {},
  ): Promise<Vacancy> {
    const parsed = archiveVacancyInputSchema.safeParse({
      vacancyId: vacancyId as string,
      reason: input.reason?.replace(/\s+/g, " ").trim() || undefined,
    });

    if (!parsed.success) {
      throw new VacanciesValidationError(
        parsed.error.issues[0]?.message ?? "Ongeldige archiveringsinvoer.",
      );
    }

    const existing = await this.repository.findById(context.organizationId, vacancyId);

    if (!existing) {
      throw new VacanciesValidationError("Vacature niet gevonden.");
    }

    if (existing.status === "closed") {
      throw new VacanciesValidationError("Vacature is al gearchiveerd.");
    }

    return this.repository.archive(context.organizationId, vacancyId);
  }
}
