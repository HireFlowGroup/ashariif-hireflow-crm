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
  return {
    ...input,
    ...(input.name !== undefined ? { name: collapseWhitespace(input.name) } : {}),
    ...(input.website !== undefined ? { website: normalizeOptionalUrl(input.website) } : {}),
    ...(input.linkedinUrl !== undefined ? { linkedinUrl: normalizeOptionalUrl(input.linkedinUrl) } : {}),
    ...(input.careersUrl !== undefined ? { careersUrl: normalizeOptionalUrl(input.careersUrl) } : {}),
    ...(input.vacancyPageUrl !== undefined ? { vacancyPageUrl: normalizeOptionalUrl(input.vacancyPageUrl) } : {}),
    ...(input.sourceUrl !== undefined ? { sourceUrl: normalizeOptionalUrl(input.sourceUrl) } : {}),
    ...(input.sector !== undefined ? { sector: normalizeOptionalString(input.sector) } : {}),
    ...(input.city !== undefined ? { city: normalizeOptionalString(input.city) } : {}),
    ...(input.region !== undefined ? { region: normalizeOptionalString(input.region) } : {}),
    ...(input.notes !== undefined ? { notes: normalizeOptionalString(input.notes) } : {}),
    ...(input.email !== undefined ? { email: normalizeOptionalString(input.email) } : {}),
    ...(input.phone !== undefined ? { phone: normalizeOptionalString(input.phone) } : {}),
    ...(input.generalEmail !== undefined ? { generalEmail: normalizeOptionalString(input.generalEmail) } : {}),
    ...(input.hrEmail !== undefined ? { hrEmail: normalizeOptionalString(input.hrEmail) } : {}),
    ...(input.kvkNumber !== undefined ? { kvkNumber: normalizeOptionalString(input.kvkNumber) } : {}),
    ...(input.aiSummary !== undefined ? { aiSummary: normalizeOptionalString(input.aiSummary) } : {}),
    ...(input.discoveryReason !== undefined
      ? { discoveryReason: normalizeOptionalString(input.discoveryReason) }
      : {}),
    ...(input.discoveryProvider !== undefined
      ? { discoveryProvider: normalizeOptionalString(input.discoveryProvider) }
      : {}),
    ...(input.scoreReason !== undefined ? { scoreReason: normalizeOptionalString(input.scoreReason) } : {}),
    ...(input.source !== undefined ? { source: normalizeOptionalString(input.source) } : {}),
  };
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
