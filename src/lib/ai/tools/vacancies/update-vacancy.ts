import { toCompanyId } from "@/features/companies/domain";
import { toVacancyId } from "@/features/vacancies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { updateVacancyToolParametersSchema } from "@/features/vacancies/validation";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export { updateVacancyToolParametersSchema };

export const updateVacancyTool: HireFlowTool<typeof updateVacancyToolParametersSchema> = {
  name: "updateVacancy",
  description:
    "Werkt een bestaande vacature bij (gedeeltelijke update). Gebruik searchVacancies om het juiste vacancyId te vinden.",
  parameters: updateVacancyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const vacanciesService = await createVacanciesService();
      const { vacancyId, ...fields } = input;

      const vacancy = await vacanciesService.updateVacancy(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        toVacancyId(vacancyId),
        {
          companyId: fields.companyId ? toCompanyId(fields.companyId) : undefined,
          title: fields.title,
          ownerId: fields.ownerId,
          description: fields.description,
          location: fields.location,
          employmentType: fields.employmentType,
          salaryMin: fields.salaryMin,
          salaryMax: fields.salaryMax,
          status: fields.status,
          requirements: fields.requirements,
        },
      );

      return {
        success: true,
        message: "Vacature is succesvol bijgewerkt.",
        vacancy,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Vacature kon niet worden bijgewerkt.";

      return {
        success: false,
        message,
      };
    }
  },
};
