import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

const periodSchema = z.enum(["7d", "30d", "90d"]).optional();

export const getTopGrowingCompaniesToolParametersSchema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
  period: periodSchema,
});

export const getTopGrowingCompaniesTool: HireFlowTool<
  typeof getTopGrowingCompaniesToolParametersSchema
> = {
  name: "getTopGrowingCompanies",
  description:
    "Haalt de top groeiende bedrijven op uit de HireFlow database op basis van hiring intensity, signalen en lead score. Gebruik voor vragen als 'Welke bedrijven groeien snel?' Retourneert maximaal 25 resultaten met bewijs uit de database.",
  parameters: getTopGrowingCompaniesToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getTopGrowingCompanies(context.organizationId, {
        limit: input.limit,
        period: input.period,
      });

      if (result.total === 0) {
        return {
          success: true,
          message: "Geen groeiende bedrijven gevonden in de database voor deze periode.",
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `Top ${result.total} groeiende bedrijven opgehaald uit de database.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Groeiende bedrijven ophalen mislukt.",
        total: 0,
      };
    }
  },
};
