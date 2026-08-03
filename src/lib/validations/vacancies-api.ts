import { z } from "zod";
import {
  createVacancyInputSchema,
  updateVacancyInputSchema,
} from "@/features/vacancies/validation";

const vacancyStatusSchema = z.enum(["draft", "open", "on_hold", "closed"]);
const employmentTypeSchema = z.enum(["full_time", "part_time", "contract", "temporary"]);

export const listVacanciesQuerySchema = z.object({
  query: z.string().trim().max(200).optional(),
  status: vacancyStatusSchema.optional(),
  companyId: z.string().uuid().optional(),
  employmentType: employmentTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
  includeArchived: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === "true"),
});

export const createVacancyBodySchema = createVacancyInputSchema;

export const updateVacancyBodySchema = updateVacancyInputSchema;

export const archiveVacancyBodySchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type ListVacanciesQuery = z.infer<typeof listVacanciesQuerySchema>;
