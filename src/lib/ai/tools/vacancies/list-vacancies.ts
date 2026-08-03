import type { Vacancy } from "@/features/vacancies/domain";
import { toCompanyId } from "@/features/companies/domain";
import { createVacanciesService } from "@/features/vacancies/create-vacancies-service";
import { listVacanciesInputSchema } from "@/features/vacancies/validation";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const listVacanciesToolParametersSchema = listVacanciesInputSchema;

export const listVacanciesTool: HireFlowTool<typeof listVacanciesToolParametersSchema> = {
  name: "listVacancies",
  description:
    "Haalt een pagina vacatures op uit het CRM (standaard open/draft/on_hold, max 50). Gebruik searchVacancies voor gericht zoeken.",
  parameters: listVacanciesToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const vacanciesService = await createVacanciesService();

      const { vacancies, total } = await vacanciesService.listVacancies(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        {
          limit: input.limit,
          offset: input.offset,
          includeArchived: input.includeArchived,
          companyId: input.companyId ? toCompanyId(input.companyId) : undefined,
        },
      );

      const message =
        total === 0
          ? "Geen vacatures gevonden."
          : `${vacancies.length} van ${total} vacature${total === 1 ? "" : "s"} opgehaald.`;

      return {
        success: true,
        message,
        vacancies: vacancies as Vacancy[],
        total,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Vacatures konden niet worden opgehaald.";

      return {
        success: false,
        message,
        vacancies: [],
        total: 0,
      };
    }
  },
};
