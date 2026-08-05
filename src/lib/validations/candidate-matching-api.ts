import { z } from "zod";

import { candidateMatchInputSchema } from "@/features/candidate-matching/domain/match.types";

export const vacancyMatchParamsSchema = z.object({
  vacancyId: z.string().uuid("vacancyId moet een geldige UUID zijn."),
});

export const vacancyMatchBodySchema = z
  .object({
    candidateId: z.string().uuid().optional(),
    candidate: candidateMatchInputSchema.optional(),
    companyName: z.string().max(200).nullable().optional(),
  })
  .refine((value) => value.candidateId || value.candidate, {
    message: "Geef candidateId of candidate-profiel op.",
  });
