import { toCompanyId } from "@/features/companies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { createVacancyInputSchema } from "@/features/vacancies/validation";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const createVacancyToolParametersSchema = createVacancyInputSchema;

export const createVacancyTool: HireFlowTool<typeof createVacancyToolParametersSchema> = {
  name: "createVacancy",
  description:
    "Maakt een nieuwe vacature aan in het CRM van de huidige organisatie. companyId en title zijn verplicht. Gebruik searchCompanies om het bedrijf te vinden.",
  parameters: createVacancyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const vacanciesService = await createVacanciesService();

      const vacancy = await vacanciesService.createVacancy(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        {
          companyId: toCompanyId(input.companyId),
          title: input.title,
          description: input.description ?? null,
          location: input.location ?? null,
          employmentType: input.employmentType,
          salaryMin: input.salaryMin ?? null,
          salaryMax: input.salaryMax ?? null,
          status: input.status,
          requirements: input.requirements ?? null,
        },
      );

      return {
        success: true,
        message: "Vacature is succesvol aangemaakt.",
        vacancyId: vacancy.id,
        vacancy,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Vacature kon niet worden aangemaakt.";

      return {
        success: false,
        message,
      };
    }
  },
};
