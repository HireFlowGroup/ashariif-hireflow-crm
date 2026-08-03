import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

const periodSchema = z.enum(["7d", "30d", "90d"]).optional();

export const getCompaniesByVacancyRoleToolParametersSchema = z.object({
  roleTitle: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(25).optional(),
  period: periodSchema,
});

export const getCompaniesByVacancyRoleTool: HireFlowTool<
  typeof getCompaniesByVacancyRoleToolParametersSchema
> = {
  name: "getCompaniesByVacancyRole",
  description:
    "Zoekt bedrijven in HireFlow met vacatures waarvan de titel overeenkomt met een rol (bijv. accountmanager, recruiter, developer). Gebruik voor 'Welke bedrijven zoeken accountmanagers?' Retourneert max 25 bedrijven gegroepeerd op vacaturematch.",
  parameters: getCompaniesByVacancyRoleToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.getCompaniesByVacancyRole(
        context.organizationId,
        input.roleTitle,
        { limit: input.limit, period: input.period },
      );

      if (result.total === 0) {
        return {
          success: true,
          message: `Geen bedrijven met vacatures voor "${input.roleTitle}" gevonden in de database.`,
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.total} bedrijven met vacatures voor "${input.roleTitle}" opgehaald.`,
        data: result,
        total: result.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Vacature-rol zoeken mislukt.",
        total: 0,
      };
    }
  },
};
