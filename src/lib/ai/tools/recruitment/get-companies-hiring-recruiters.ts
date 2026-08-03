import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

const periodSchema = z.enum(["7d", "30d", "90d"]).optional();

export const getCompaniesHiringRecruitersToolParametersSchema = z.object({
  limit: z.number().int().min(1).max(25).optional(),
  period: periodSchema,
});

export const getCompaniesHiringRecruitersTool: HireFlowTool<
  typeof getCompaniesHiringRecruitersToolParametersSchema
> = {
  name: "getCompaniesHiringRecruiters",
  description:
    "Haalt bedrijven op die recruiters of HR managers zoeken op basis van hiring signals (new_recruiter, new_hr_manager). Gebruik voor 'Welke bedrijven zoeken recruiters?' Maximaal 25 resultaten.",
  parameters: getCompaniesHiringRecruitersToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getCompaniesHiringRecruiters(context.organizationId, {
        limit: input.limit,
        period: input.period,
      });

      if (result.total === 0) {
        return {
          success: true,
          message: "Geen bedrijven gevonden die recruiters zoeken in de database.",
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.total} bedrijven die recruiters zoeken opgehaald.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Recruiter-signalen ophalen mislukt.",
        total: 0,
      };
    }
  },
};
