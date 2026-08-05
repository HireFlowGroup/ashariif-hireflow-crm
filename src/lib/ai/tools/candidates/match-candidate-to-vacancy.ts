import { z } from "zod";

import { createCandidateMatchingService } from "@/features/candidate-matching/create-candidate-matching-service";
import { candidateMatchInputSchema } from "@/features/candidate-matching/domain/match.types";
import { toCandidateId } from "@/features/candidates/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const matchCandidateToVacancyToolParametersSchema = z
  .object({
    vacancyId: z.string().uuid(),
    candidateId: z.string().uuid().optional(),
    candidate: candidateMatchInputSchema.optional(),
    companyName: z.string().max(200).nullable().optional(),
  })
  .refine((value) => value.candidateId || value.candidate, {
    message: "Geef candidateId of candidate-profiel op.",
  });

export const matchCandidateToVacancyTool: HireFlowTool<
  typeof matchCandidateToVacancyToolParametersSchema
> = {
  name: "matchCandidateToVacancy",
  description:
    "Beoordeelt een kandidaat op een vacature: matchscore, sterke punten, risico's, salarisverwachting, beschikbaarheid en een eerlijke introductie (max 150 woorden) voor de opdrachtgever.",
  parameters: matchCandidateToVacancyToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const matchingService = await createCandidateMatchingService();
      const result = await matchingService.matchCandidateToVacancy(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        {
          vacancyId: toVacancyId(input.vacancyId),
          candidateId: input.candidateId ? toCandidateId(input.candidateId) : undefined,
          candidate: input.candidate,
          companyName: input.companyName ?? null,
        },
      );

      return {
        success: true,
        message: `Matchscore ${result.match.matchScore}/100 voor ${result.candidateName} op ${result.vacancyTitle}.`,
        data: result,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Kandidaatmatch kon niet worden berekend.";

      return {
        success: false,
        message,
      };
    }
  },
};
