import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const getQuietClientsToolParametersSchema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
  quietDays: z.number().int().min(7).max(180).optional(),
});

export const getQuietClientsTool: HireFlowTool<typeof getQuietClientsToolParametersSchema> = {
  name: "getQuietClients",
  description:
    "Haalt bedrijven op die stilgevallen zijn: eerder actief (signals/outreach/score) maar zonder recente hiring activiteit in HireFlow. Gebruik voor 'Welke klanten zijn stilgevallen?' Retourneert max 25 resultaten met dagen sinds laatste signaal.",
  parameters: getQuietClientsToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getQuietClients(context.organizationId, {
        limit: input.limit,
        quietDays: input.quietDays,
      });

      if (result.total === 0) {
        return {
          success: true,
          message: "Geen stilgevallen klanten gevonden in de database voor deze drempel.",
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.total} stilgevallen klanten opgehaald uit de database.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Stilgevallen klanten ophalen mislukt.",
        total: 0,
      };
    }
  },
};
