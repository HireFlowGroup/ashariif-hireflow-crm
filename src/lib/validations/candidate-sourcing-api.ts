import { z } from "zod";

export const candidateSourcingSearchBodySchema = z.object({
  vacancyId: z.string().uuid(),
  jobTitle: z.string().trim().max(120).optional(),
  additionalJobTitles: z.array(z.string().trim().max(120)).max(5).optional(),
  location: z.string().trim().max(120).optional(),
  locationRadiusKm: z.number().int().min(0).max(200).optional(),
  skills: z.array(z.string().trim().max(80)).max(12).optional(),
  experienceYearsMin: z.number().int().min(0).max(50).optional(),
  industry: z.string().trim().max(120).optional(),
  keywords: z.array(z.string().trim().max(80)).max(12).optional(),
  naturalLanguageInstructions: z.string().trim().max(800).optional(),
});

export const proposalIdParamsSchema = z.object({
  proposalId: z.string().uuid(),
});

export const runIdParamsSchema = z.object({
  runId: z.string().uuid(),
});