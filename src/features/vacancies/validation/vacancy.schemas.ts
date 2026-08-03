import { z } from "zod";

const vacancyStatusSchema = z.enum(["draft", "open", "on_hold", "closed"]);

const employmentTypeSchema = z.enum(["full_time", "part_time", "contract", "temporary"]);

const optionalTrimmedString = (max: number, message: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length === 0 ? undefined : trimmed;
    },
    z.string().max(max, message).optional(),
  );

const nullableSalarySchema = z
  .number()
  .min(0, "Salaris mag niet negatief zijn.")
  .nullable()
  .optional();

function salaryRangeRefine(data: {
  salaryMin?: number | null;
  salaryMax?: number | null;
}): boolean {
  const min = data.salaryMin;
  const max = data.salaryMax;

  if (min == null || max == null) {
    return true;
  }

  return max >= min;
}

export const createVacancyInputSchema = z
  .object({
    companyId: z.string().uuid("Ongeldig bedrijf-id."),
    title: z
      .string()
      .trim()
      .min(1, "Vacaturetitel is verplicht.")
      .max(200, "Vacaturetitel is te lang."),
    ownerId: z.string().uuid("Ongeldige ownerId.").nullable().optional(),
    description: optionalTrimmedString(10000, "Omschrijving is te lang."),
    location: optionalTrimmedString(200, "Locatie is te lang."),
    employmentType: employmentTypeSchema.optional(),
    salaryMin: nullableSalarySchema,
    salaryMax: nullableSalarySchema,
    status: vacancyStatusSchema.optional(),
    requirements: optionalTrimmedString(10000, "Vereisten zijn te lang."),
  })
  .refine(salaryRangeRefine, {
    message: "Maximaal salaris mag niet lager zijn dan minimaal salaris.",
    path: ["salaryMax"],
  });

const updateVacancyFieldsSchema = z.object({
  companyId: z.string().uuid("Ongeldig bedrijf-id.").optional(),
  title: z
    .string()
    .trim()
    .min(1, "Vacaturetitel mag niet leeg zijn.")
    .max(200, "Vacaturetitel is te lang.")
    .optional(),
  ownerId: z.string().uuid("Ongeldige ownerId.").nullable().optional(),
  description: z
    .string()
    .trim()
    .max(10000, "Omschrijving is te lang.")
    .nullable()
    .optional(),
  location: z
    .string()
    .trim()
    .max(200, "Locatie is te lang.")
    .nullable()
    .optional(),
  employmentType: employmentTypeSchema.optional(),
  salaryMin: nullableSalarySchema,
  salaryMax: nullableSalarySchema,
  status: vacancyStatusSchema.optional(),
  requirements: z
    .string()
    .trim()
    .max(10000, "Vereisten zijn te lang.")
    .nullable()
    .optional(),
});

function applyUpdateVacancyRefines<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
) {
  return schema
    .refine(
      (value) =>
        Object.entries(value).some(
          ([, fieldValue]) => fieldValue !== undefined,
        ),
      { message: "Minimaal één veld is verplicht voor een update." },
    )
    .refine(salaryRangeRefine, {
      message: "Maximaal salaris mag niet lager zijn dan minimaal salaris.",
      path: ["salaryMax"],
    });
}

export const updateVacancyInputSchema = applyUpdateVacancyRefines(
  updateVacancyFieldsSchema,
);

export const updateVacancyToolParametersSchema = applyUpdateVacancyRefines(
  updateVacancyFieldsSchema.extend({
    vacancyId: z.string().uuid("Ongeldig vacature-id."),
  }),
).refine(
  (value) =>
    Object.entries(value).some(
      ([key, fieldValue]) => key !== "vacancyId" && fieldValue !== undefined,
    ),
  {
    message: "Minimaal één veld naast vacancyId is verplicht voor een update.",
  },
);

export const getVacancyInputSchema = z.object({
  vacancyId: z.string().uuid("Ongeldig vacature-id."),
});

export const searchVacanciesInputSchema = z.object({
  query: z.string().trim().max(200, "Zoekterm is te lang.").optional(),
  companyId: z.string().uuid("Ongeldig bedrijf-id.").optional(),
  location: z.string().trim().max(200, "Locatie is te lang.").optional(),
  employmentType: employmentTypeSchema.optional(),
  status: vacancyStatusSchema.optional(),
  archived: z.boolean().optional(),
  limit: z
    .number()
    .int()
    .min(1, "Limit moet minimaal 1 zijn.")
    .max(100, "Limit mag maximaal 100 zijn.")
    .optional()
    .default(20),
});

export const listVacanciesInputSchema = z.object({
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
  companyId: z.string().uuid("Ongeldig bedrijf-id.").optional(),
});

export const archiveVacancyInputSchema = z.object({
  vacancyId: z.string().uuid("Ongeldig vacature-id."),
  reason: z.string().trim().max(500, "Reden is te lang.").optional(),
});

export type CreateVacancyInputDto = z.infer<typeof createVacancyInputSchema>;
export type UpdateVacancyInputDto = z.infer<typeof updateVacancyInputSchema>;
export type UpdateVacancyToolParametersDto = z.infer<
  typeof updateVacancyToolParametersSchema
>;
export type GetVacancyInputDto = z.infer<typeof getVacancyInputSchema>;
export type SearchVacanciesInputDto = z.infer<typeof searchVacanciesInputSchema>;
export type ListVacanciesInputDto = z.infer<typeof listVacanciesInputSchema>;
export type ArchiveVacancyInputDto = z.infer<typeof archiveVacancyInputSchema>;
