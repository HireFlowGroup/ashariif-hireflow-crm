import type { CreateVacancyInput, UpdateVacancyInput } from "@/features/vacancies/domain";

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeOptionalString(value: string | null | undefined): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const trimmed = collapseWhitespace(value);
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeCreateVacancyInput(input: CreateVacancyInput): CreateVacancyInput {
  return {
    ...input,
    title: collapseWhitespace(input.title),
    description: normalizeOptionalString(input.description),
    location: normalizeOptionalString(input.location),
    requirements: normalizeOptionalString(input.requirements),
    ownerId: input.ownerId,
    employmentType: input.employmentType,
    salaryMin: input.salaryMin,
    salaryMax: input.salaryMax,
    status: input.status,
    companyId: input.companyId,
  };
}

export function normalizeUpdateVacancyInput(input: UpdateVacancyInput): UpdateVacancyInput {
  const normalized: UpdateVacancyInput = {};

  if (input.companyId !== undefined) {
    normalized.companyId = input.companyId;
  }

  if (input.title !== undefined) {
    normalized.title = collapseWhitespace(input.title);
  }

  if (input.description !== undefined) {
    normalized.description = normalizeOptionalString(input.description);
  }

  if (input.location !== undefined) {
    normalized.location = normalizeOptionalString(input.location);
  }

  if (input.requirements !== undefined) {
    normalized.requirements = normalizeOptionalString(input.requirements);
  }

  if (input.ownerId !== undefined) {
    normalized.ownerId = input.ownerId;
  }

  if (input.employmentType !== undefined) {
    normalized.employmentType = input.employmentType;
  }

  if (input.salaryMin !== undefined) {
    normalized.salaryMin = input.salaryMin;
  }

  if (input.salaryMax !== undefined) {
    normalized.salaryMax = input.salaryMax;
  }

  if (input.status !== undefined) {
    normalized.status = input.status;
  }

  return normalized;
}

export function assertSalaryRange(min: number | null, max: number | null): void {
  if (min != null && max != null && max < min) {
    throw new Error("Maximaal salaris mag niet lager zijn dan minimaal salaris.");
  }
}
