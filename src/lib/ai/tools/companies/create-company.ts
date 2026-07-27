import { z } from "zod";
import type { Company } from "@/features/companies/domain";
import { createCompaniesService } from "@/features/companies/create-companies-service";
import type { HireFlowTool, ToolExecutionContext, ToolResult } from "@/lib/ai/tools/types";

export const createCompanyToolParametersSchema = z.object({
  name: z
    .string()
    .min(1, "Bedrijfsnaam is verplicht.")
    .max(200, "Bedrijfsnaam is te lang."),
  website: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  sector: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateCompanyToolParameters = z.infer<typeof createCompanyToolParametersSchema>;

export type CreateCompanyToolResult = ToolResult & {
  companyId?: string;
  company?: Company;
};

export const createCompanyTool: HireFlowTool<typeof createCompanyToolParametersSchema> = {
  name: "createCompany",
  description:
    "Maakt een nieuw bedrijf aan in het CRM van de huidige organisatie. Gebruik dit wanneer de gebruiker expliciet een bedrijf wil registreren.",
  parameters: createCompanyToolParametersSchema,
  strict: true,
  execute: async (
    input,
    context: ToolExecutionContext,
  ): Promise<ToolResult> => {
    try {
      const companiesService = await createCompaniesService();

      const company = await companiesService.createCompany(
        {
          organizationId: context.organizationId,
          userId: context.userId,
        },
        {
          name: input.name,
          website: input.website,
          email: input.email,
          phone: input.phone,
          city: input.city,
          sector: input.sector,
          notes: input.notes,
        },
      );

      return {
        success: true,
        message: "Bedrijf is succesvol aangemaakt.",
        companyId: company.id,
        company,
      };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Bedrijf kon niet worden aangemaakt.";

      return {
        success: false,
        message,
      };
    }
  },
};
