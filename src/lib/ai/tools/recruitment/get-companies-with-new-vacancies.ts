import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

const periodSchema = z.enum(["7d", "30d", "90d"]).optional();

export const getCompaniesWithNewVacanciesToolParametersSchema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
  period: periodSchema,
});

export const getCompaniesWithNewVacanciesTool: HireFlowTool<
  typeof getCompaniesWithNewVacanciesToolParametersSchema
> = {
  name: "getCompaniesWithNewVacancies",
  description:
    "Haalt bedrijven op met nieuwe vacatures uit de HireFlow database. Gebruik voor 'Welke bedrijven hebben nieuwe vacatures?' Retourneert maximaal 25 bedrijven met vacature-aantallen en datums.",
  parameters: getCompaniesWithNewVacanciesToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getCompaniesWithNewVacancies(context.organizationId, {
        limit: input.limit,
        period: input.period,
      });

      if (result.total === 0) {
        return {
          success: true,
          message: "Geen bedrijven met nieuwe vacatures gevonden in de database.",
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.total} bedrijven met nieuwe vacatures opgehaald.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Vacaturedata ophalen mislukt.",
        total: 0,
      };
    }
  },
};
