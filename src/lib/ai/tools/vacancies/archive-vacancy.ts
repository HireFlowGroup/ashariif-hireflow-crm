import { toVacancyId } from "@/features/vacancies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { archiveVacancyInputSchema } from "@/features/vacancies/validation";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const archiveVacancyToolParametersSchema = archiveVacancyInputSchema;

export const archiveVacancyTool: HireFlowTool<
  typeof archiveVacancyToolParametersSchema
> = {
  name: "archiveVacancy",
  description:
    "Archiveert een vacature (status closed). Gebruik searchVacancies om het juiste vacancyId te vinden.",
  parameters: archiveVacancyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const vacanciesService = await createVacanciesService();

      const vacancy = await vacanciesService.archiveVacancy(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        toVacancyId(input.vacancyId),
        { reason: input.reason },
      );

      return {
        success: true,
        message: "Vacature is succesvol gearchiveerd (status closed).",
        vacancy,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Vacature kon niet worden gearchiveerd.";

      return {
        success: false,
        message,
      };
    }
  },
};
