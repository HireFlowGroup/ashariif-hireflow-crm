import { z } from "zod";

import { createRecruitmentAssistantService } from "@/features/recruitment-assistant";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const findSimilarCompaniesToolParametersSchema = z.object({
  companyName: z.string().min(1).max(200),
  limit: z.number().int().min(1).max(25).optional(),
});

export const findSimilarCompaniesTool: HireFlowTool<typeof findSimilarCompaniesToolParametersSchema> = {
  name: "findSimilarCompanies",
  description:
    "Vindt bedrijven in de HireFlow database die lijken op een referentiebedrijf (sector, stad, lead score, hiring intensity). Gebruik voor 'Welke bedrijven lijken op Coolblue?' Maximaal 25 vergelijkbare bedrijven.",
  parameters: findSimilarCompaniesToolParametersSchema,
  strict: true,
  execute: async (input, context: ToolExecutionContext): Promise<ToolResult> => {
    try {
      const service = await createRecruitmentAssistantService();
      const result = await service.findSimilarCompanies(
        context.organizationId,
        input.companyName,
        { limit: input.limit },
      );

      if (!result.referenceCompany) {
        return {
          success: true,
          message: `Geen bedrijf gevonden met naam "${input.companyName}" in de database.`,
          data: result,
          total: 0,
        };
      }

      if (result.similar.total === 0) {
        return {
          success: true,
          message: `Referentiebedrijf "${result.referenceCompany.name}" gevonden, maar geen vergelijkbare bedrijven in de database.`,
          data: result,
          total: 0,
        };
      }

      return {
        success: true,
        message: `${result.similar.total} bedrijven vergelijkbaar met "${result.referenceCompany.name}" opgehaald.`,
        data: result,
        total: result.similar.total,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Vergelijkbare bedrijven ophalen mislukt.",
        total: 0,
      };
    }
  },
};
