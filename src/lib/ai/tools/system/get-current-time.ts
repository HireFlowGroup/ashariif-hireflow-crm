import { z } from "zod";
import type { HireFlowTool } from "@/lib/ai/tools/types";

export const getCurrentTimeInputSchema = z.object({
  timezone: z
    .string()
    .trim()
    .min(1, "Timezone mag niet leeg zijn.")
    .max(64, "Timezone is te lang.")
    .optional()
    .describe("Optionele IANA-timezone, bijvoorbeeld Europe/Amsterdam."),
});

const DEFAULT_TIMEZONE = "Europe/Amsterdam";

export type GetCurrentTimeInput = z.infer<typeof getCurrentTimeInputSchema>;

export type GetCurrentTimeData = {
  iso: string;
  locale: string;
  timezone: string;
};

export const getCurrentTimeTool: HireFlowTool<typeof getCurrentTimeInputSchema> = {
  name: "getCurrentTime",
  description:
    "Geeft de huidige datum en tijd van de server. Gebruik dit wanneer de gebruiker vraagt naar de actuele tijd of datum.",
  parameters: getCurrentTimeInputSchema,
  strict: true,
  execute: async (input) => {
    const timezone = input.timezone ?? DEFAULT_TIMEZONE;
    const now = new Date();

    let locale: string;

    try {
      locale = now.toLocaleString("nl-NL", { timeZone: timezone });
    } catch {
      return {
        success: false,
        message: "Ongeldige timezone opgegeven.",
      };
    }

    const data: GetCurrentTimeData = {
      iso: now.toISOString(),
      locale,
      timezone,
    };

    return {
      success: true,
      message: "Huidige tijd opgehaald.",
      data,
    };
  },
};
