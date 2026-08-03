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

const leadPrioritySchema = z.enum(["A", "B", "C", "D"]);

const scoreBreakdownSchema = z
  .object({
    version: z.string().optional(),
    components: z.record(z.number()).optional(),
    recruitmentActivity: z.number().optional(),
    growth: z.number().optional(),
    hiringUrgency: z.number().optional(),
    urgency: z.number().optional(),
    contactability: z.number().optional(),
    digitalPresence: z.number().optional(),
    decisionMakerAvailability: z.number().optional(),
    aiMatch: z.number().optional(),
    outreachDifficulty: z.number().optional(),
    outreachPotential: z.number().optional(),
    sectorMatch: z.number().optional(),
    regionMatch: z.number().optional(),
    companySize: z.number().optional(),
    activeVacancies: z.number().optional(),
    relevantVacancies: z.number().optional(),
    contactCompleteness: z.number().optional(),
    sourceQuality: z.number().optional(),
    crmStatus: z.number().optional(),
    exclusionPenalty: z.number().optional(),
  })
  .passthrough();

export const createCompanyInputSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Bedrijfsnaam is verplicht.")
    .max(200, "Bedrijfsnaam is te lang."),
  ownerId: z.string().uuid("Ongeldige ownerId.").nullable().optional(),
  website: optionalUrlSchema,
  domain: z.string().trim().max(200).nullable().optional(),
  linkedinUrl: optionalUrlSchema,
  email: optionalEmailSchema,
  phone: z.string().trim().max(40, "Telefoonnummer is te lang.").nullable().optional(),
  sector: z.string().trim().max(120, "Sector is te lang.").nullable().optional(),
  city: z.string().trim().max(120, "Plaats is te lang.").nullable().optional(),
  region: z.string().trim().max(120).nullable().optional(),
  country: z.string().trim().max(80).nullable().optional(),
  employeeCount: z.number().int().positive().nullable().optional(),
  employeeCountMin: z.number().int().positive().nullable().optional(),
  employeeCountMax: z.number().int().positive().nullable().optional(),
  priority: companyPrioritySchema.nullable().optional(),
  leadScore: z.number().int().min(0).max(100).nullable().optional(),
  leadPriority: leadPrioritySchema.nullable().optional(),
  scoreReason: z.string().trim().max(500).nullable().optional(),
  scoreBreakdown: scoreBreakdownSchema.nullable().optional(),
  vacancyCount: z.number().int().min(0).optional(),
  hiringSignals: z.array(z.object({
    type: z.string(),
    description: z.string(),
    source: z.string(),
    confidence: z.number(),
  })).optional(),
  source: z.string().trim().max(120).nullable().optional(),
  sourceUrl: optionalUrlSchema,
  confidence: z.number().min(0).max(1).nullable().optional(),
  companyType: z.string().trim().max(80).nullable().optional(),
  companyConfidence: z.number().int().min(0).max(100).nullable().optional(),
  discoveryReason: z.string().trim().max(2000).nullable().optional(),
  discoveryProvider: z.string().trim().max(120).nullable().optional(),
  lastVerifiedAt: z.string().datetime().nullable().optional(),
  outreachStatus: z.enum(["none", "queued", "draft", "review", "sent", "blocked"]).optional(),
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
  leadPriority: z.enum(["A", "B", "C", "D"]).optional(),
  hasVacancies: z.boolean().optional(),
  outreachReady: z.boolean().optional(),
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
