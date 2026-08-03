import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

const periodSchema = z.enum(["7d", "30d", "90d"]).optional();

export const getWarmingLeadsToolParametersSchema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
  period: periodSchema,
  minDelta: z.number().int().min(1).max(50).optional(),
});

export const getWarmingLeadsTool: HireFlowTool<typeof getWarmingLeadsToolParametersSchema> = {
  name: "getWarmingLeads",
  description:
    "Haalt leads op waarvan de leadscore recent is gestegen (warmer geworden) op basis van company_scores historie in HireFlow. Gebruik voor 'Welke leads zijn warmer geworden?' Retourneert max 25 resultaten met score-delta en bewijs.",
  parameters: getWarmingLeadsToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getWarmingLeads(context.organizationId, {
        limit: input.limit,
        period: input.period,
        minDelta: input.minDelta,
      });

      if (result.total === 0) {
        return {
          success: true,
          message: "Geen warmer geworden leads gevonden in de database voor deze periode.",
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.total} warmer geworden leads opgehaald uit de database.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Warmer geworden leads ophalen mislukt.",
        total: 0,
      };
    }
  },
};
