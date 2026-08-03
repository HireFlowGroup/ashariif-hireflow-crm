import type { Vacancy } from "@/features/vacancies/domain";
import { toCompanyId } from "@/features/companies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { searchVacanciesInputSchema } from "@/features/vacancies/validation";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const searchVacanciesToolParametersSchema = searchVacanciesInputSchema;

export const searchVacanciesTool: HireFlowTool<
  typeof searchVacanciesToolParametersSchema
> = {
  name: "searchVacancies",
  description:
    "Zoekt vacatures op titel, omschrijving, locatie, vereisten, status of bedrijf (companyId). Gebruik dit om vacatures te vinden voordat je ze opent of wijzigt.",
  parameters: searchVacanciesToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const vacanciesService = await createVacanciesService();

      const vacancies = await vacanciesService.searchVacancies(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        {
          query: input.query,
          companyId: input.companyId ? toCompanyId(input.companyId) : undefined,
          location: input.location,
          employmentType: input.employmentType,
          status: input.status,
          archived: input.archived,
          limit: input.limit ?? 20,
        },
      );

      const message =
        vacancies.length === 0
          ? "Geen vacatures gevonden voor deze zoekopdracht."
          : `${vacancies.length} vacature${vacancies.length === 1 ? "" : "s"} gevonden.`;

      return {
        success: true,
        message,
        vacancies: vacancies as Vacancy[],
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Vacatures konden niet worden gezocht.";

      return {
        success: false,
        message,
        vacancies: [],
      };
    }
  },
};
