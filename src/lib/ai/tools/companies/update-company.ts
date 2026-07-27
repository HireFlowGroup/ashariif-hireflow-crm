import { z } from "zod";
import { toCompanyId } from "@/features/companies/domain";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

function emptyStringToUndefined(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

const optionalToolString = (maxLength: number, message: string) =>
  z.preprocess(
    emptyStringToUndefined,
    z.string().max(maxLength, message).optional(),
  );

export const updateCompanyToolParametersSchema = z
  .object({
    companyId: z.string().uuid("Ongeldig bedrijf-id."),
    name: optionalToolString(200, "Bedrijfsnaam is te lang."),
    website: optionalToolString(500, "Website is te lang."),
    email: optionalToolString(320, "E-mail is te lang."),
    phone: optionalToolString(40, "Telefoonnummer is te lang."),
    city: optionalToolString(120, "Plaats is te lang."),
    sector: optionalToolString(120, "Sector is te lang."),
    notes: optionalToolString(5000, "Notities zijn te lang."),
    status: z.enum(["active", "inactive", "prospect", "archived"]).optional(),
  })
  .refine(
    (value) =>
      Object.entries(value).some(([key, fieldValue]) => {
        if (key === "companyId") {
          return false;
        }

        return fieldValue !== undefined;
      }),
    { message: "Minimaal één veld naast companyId is verplicht voor een update." },
  );

export const updateCompanyTool: HireFlowTool<typeof updateCompanyToolParametersSchema> = {
  name: "updateCompany",
  description:
    "Werkt een bestaand bedrijf bij in het CRM van de huidige organisatie. Gebruik searchCompanies om het juiste companyId te vinden.",
  parameters: updateCompanyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const companiesService = await createCompaniesService();

      const company = await companiesService.updateCompany(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        toCompanyId(input.companyId),
        {
          name: input.name,
          website: input.website,
          email: input.email,
          phone: input.phone,
          city: input.city,
          sector: input.sector,
          notes: input.notes,
          status: input.status,
        },
      );

      return {
        success: true,
        message: "Bedrijf is succesvol bijgewerkt.",
        company,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bedrijf kon niet worden bijgewerkt.";

      return {
        success: false,
        message,
      };
    }
  },
};
