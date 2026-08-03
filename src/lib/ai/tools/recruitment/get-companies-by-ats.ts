import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const getCompaniesByAtsToolParametersSchema = z.object({
  atsName: z.string().min(1).max(100),
  limit: z.number().int().min(1).max(25).optional(),
});

export const getCompaniesByAtsTool: HireFlowTool<typeof getCompaniesByAtsToolParametersSchema> = {
  name: "getCompaniesByAts",
  description:
    "Zoekt bedrijven in HireFlow die een specifieke ATS gebruiken (bijv. Recruitee, Greenhouse, Lever) op basis van hiring signals en ATS-detectie. Gebruik voor 'Welke bedrijven gebruiken Recruitee?' Retourneert max 25 resultaten met bronbewijs.",
  parameters: getCompaniesByAtsToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getCompaniesByAts(context.organizationId, input.atsName, {
        limit: input.limit,
      });

      if (result.total === 0) {
        return {
          success: true,
          message: `Geen bedrijven gevonden met ATS "${input.atsName}" in de HireFlow database.`,
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.total} bedrijven met ATS "${input.atsName}" opgehaald uit de database.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "ATS-bedrijven ophalen mislukt.",
        total: 0,
      };
    }
  },
};
