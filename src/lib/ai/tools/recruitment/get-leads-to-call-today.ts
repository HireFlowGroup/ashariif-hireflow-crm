import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const getLeadsToCallTodayToolParametersSchema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
});

export const getLeadsToCallTodayTool: HireFlowTool<typeof getLeadsToCallTodayToolParametersSchema> = {
  name: "getLeadsToCallToday",
  description:
    "Haalt prioritaire leads op die vandaag gebeld moeten worden op basis van lead score, priority (A/B), outreach status en recente hiring activiteit. Gebruik voor 'Welke leads moet ik vandaag bellen?' Maximaal 25 resultaten.",
  parameters: getLeadsToCallTodayToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getLeadsToCallToday(context.organizationId, {
        limit: input.limit,
      });

      if (result.total === 0) {
        return {
          success: true,
          message: "Geen leads gevonden om vandaag te bellen in de database.",
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `Top ${result.total} leads om vandaag te bellen opgehaald.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Leads ophalen mislukt.",
        total: 0,
      };
    }
  },
};
