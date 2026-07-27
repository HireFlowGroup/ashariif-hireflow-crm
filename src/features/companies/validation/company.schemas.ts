import { z } from "zod";

const companyStatusSchema = z.enum(["active", "inactive", "prospect", "archived"]);

const companyPrioritySchema = z.enum(["low", "medium", "high"]);

const optionalUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().url("Ongeldige website-URL.").nullable().optional(),
);

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().email("Ongeldig e-mailadres.").nullable().optional(),
);

export const createCompanyInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Bedrijfsnaam is verplicht.")
    .max(200, "Bedrijfsnaam is te lang."),
  ownerId: z.string().uuid("Ongeldige ownerId.").nullable().optional(),
  website: optionalUrlSchema,
  email: optionalEmailSchema,
  phone: z.string().trim().max(40, "Telefoonnummer is te lang.").nullable().optional(),
  sector: z.string().trim().max(120, "Sector is te lang.").nullable().optional(),
  city: z.string().trim().max(120, "Plaats is te lang.").nullable().optional(),
  employeeCount: z
    .number()
    .int("Aantal medewerkers moet een geheel getal zijn.")
    .positive("Aantal medewerkers moet positief zijn.")
    .nullable()
    .optional(),
  priority: companyPrioritySchema.nullable().optional(),
  status: companyStatusSchema.optional(),
  notes: z.string().trim().max(5000, "Notities zijn te lang.").nullable().optional(),
});

export const updateCompanyInputSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Bedrijfsnaam mag niet leeg zijn.")
      .max(200, "Bedrijfsnaam is te lang.")
      .optional(),
    website: optionalUrlSchema,
    email: optionalEmailSchema,
    phone: z.string().trim().max(40, "Telefoonnummer is te lang.").nullable().optional(),
    sector: z.string().trim().max(120, "Sector is te lang.").nullable().optional(),
    city: z.string().trim().max(120, "Plaats is te lang.").nullable().optional(),
    notes: z.string().trim().max(5000, "Notities zijn te lang.").nullable().optional(),
    status: companyStatusSchema.optional(),
    ownerId: z.string().uuid("Ongeldige ownerId.").nullable().optional(),
    employeeCount: z
      .number()
      .int("Aantal medewerkers moet een geheel getal zijn.")
      .positive("Aantal medewerkers moet positief zijn.")
      .nullable()
      .optional(),
    priority: companyPrioritySchema.nullable().optional(),
  })
  .refine(
    (value) =>
      Object.entries(value).some(
        ([, fieldValue]) => fieldValue !== undefined && fieldValue !== null,
      ),
    { message: "Minimaal één veld is verplicht voor een update." },
  );

export const searchCompaniesInputSchema = z.object({
  query: z.string().trim().max(200, "Zoekterm is te lang.").optional(),
  city: z.string().trim().max(120, "Plaats is te lang.").optional(),
  sector: z.string().trim().max(120, "Sector is te lang.").optional(),
  archived: z.boolean().optional(),
  status: companyStatusSchema.optional(),
  priority: companyPrioritySchema.optional(),
  limit: z
    .number()
    .int()
    .min(1, "Limit moet minimaal 1 zijn.")
    .max(100, "Limit mag maximaal 100 zijn.")
    .optional()
    .default(20),
});

export const archiveCompanyInputSchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-id."),
  reason: z.string().trim().max(500, "Reden is te lang.").optional(),
});

export const getCompanyInputSchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-id."),
});

export const listCompaniesInputSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1, "Limit moet minimaal 1 zijn.")
    .max(100, "Limit mag maximaal 100 zijn.")
    .optional()
    .default(50),
  offset: z
    .number()
    .int()
    .min(0, "Offset mag niet negatief zijn.")
    .optional()
    .default(0),
  includeArchived: z.boolean().optional().default(false),
});

export const deleteCompanyInputSchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-id."),
  reason: z.string().trim().max(500, "Reden is te lang.").optional(),
});

export type CreateCompanyInputDto = z.infer<typeof createCompanyInputSchema>;
export type UpdateCompanyInputDto = z.infer<typeof updateCompanyInputSchema>;
export type SearchCompaniesInputDto = z.infer<typeof searchCompaniesInputSchema>;
export type ArchiveCompanyInputDto = z.infer<typeof archiveCompanyInputSchema>;
export type DeleteCompanyInputDto = z.infer<typeof deleteCompanyInputSchema>;
export type GetCompanyInputDto = z.infer<typeof getCompanyInputSchema>;
export type ListCompaniesInputDto = z.infer<typeof listCompaniesInputSchema>;
