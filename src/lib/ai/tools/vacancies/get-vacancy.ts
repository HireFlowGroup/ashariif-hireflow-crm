import { toVacancyId } from "@/features/vacancies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { getVacancyInputSchema } from "@/features/vacancies/validation";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const getVacancyToolParametersSchema = getVacancyInputSchema;

export const getVacancyTool: HireFlowTool<typeof getVacancyToolParametersSchema> = {
  name: "getVacancy",
  description:
    "Haalt één vacature op uit het CRM op basis van vacancyId. Gebruik searchVacancies om het juiste id te vinden.",
  parameters: getVacancyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const vacanciesService = await createVacanciesService();

      const vacancy = await vacanciesService.getVacancy(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        toVacancyId(input.vacancyId),
      );

      return {
        success: true,
        message: "Vacature is opgehaald.",
        vacancy,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Vacature kon niet worden opgehaald.";

      return {
        success: false,
        message,
      };
    }
  },
};
