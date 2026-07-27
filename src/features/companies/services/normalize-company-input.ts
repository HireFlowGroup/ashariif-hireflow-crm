import type { CreateCompanyInput, UpdateCompanyInput } from "@/features/companies/domain";

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

function normalizeOptionalUrl(value: string | null | undefined): string | null | undefined {
  const normalized = normalizeOptionalString(value);

  if (normalized === undefined || normalized === null) {
    return normalized;
  }

  return normalized;
}

/** Normalizes raw create input before Zod validation in the service layer. */
export function normalizeCreateCompanyInput(input: CreateCompanyInput): CreateCompanyInput {
  return {
    ...input,
    name: collapseWhitespace(input.name),
    website: normalizeOptionalUrl(input.website),
    sector: normalizeOptionalString(input.sector),
    city: normalizeOptionalString(input.city),
    notes: normalizeOptionalString(input.notes),
    email: normalizeOptionalString(input.email),
    phone: normalizeOptionalString(input.phone),
    ownerId: input.ownerId,
    employeeCount: input.employeeCount,
    priority: input.priority,
    status: input.status,
  };
}

export function normalizeUpdateCompanyInput(input: UpdateCompanyInput): UpdateCompanyInput {
  const normalized: UpdateCompanyInput = {};

  if (input.name !== undefined) {
    normalized.name = collapseWhitespace(input.name);
  }

  if (input.website !== undefined) {
    normalized.website = normalizeOptionalUrl(input.website);
  }

  if (input.sector !== undefined) {
    normalized.sector = normalizeOptionalString(input.sector);
  }

  if (input.city !== undefined) {
    normalized.city = normalizeOptionalString(input.city);
  }

  if (input.notes !== undefined) {
    normalized.notes = normalizeOptionalString(input.notes);
  }

  if (input.email !== undefined) {
    normalized.email = normalizeOptionalString(input.email);
  }

  if (input.phone !== undefined) {
    normalized.phone = normalizeOptionalString(input.phone);
  }

  if (input.ownerId !== undefined) {
    normalized.ownerId = input.ownerId;
  }

  if (input.employeeCount !== undefined) {
    normalized.employeeCount = input.employeeCount;
  }

  if (input.priority !== undefined) {
    normalized.priority = input.priority;
  }

  if (input.status !== undefined) {
    normalized.status = input.status;
  }

  return normalized;
}

export function composeCompanyNotes(input: {
  notes?: string | null;
  email?: string | null;
  phone?: string | null;
}): string | null {
  const segments: string[] = [];

  if (input.notes?.trim()) {
    segments.push(input.notes.trim());
  }

  if (input.email?.trim()) {
    segments.push(`E-mail: ${input.email.trim()}`);
  }

  if (input.phone?.trim()) {
    segments.push(`Telefoon: ${input.phone.trim()}`);
  }

  if (segments.length === 0) {
    return null;
  }

  return segments.join("\n");
}
