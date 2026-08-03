import { z } from "zod";

const optionalEmailSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().email("Ongeldig e-mailadres.").nullable().optional(),
);

const optionalUrlSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  },
  z.string().url("Ongeldige URL.").nullable().optional(),
);

export const createContactInputSchema = z.object({
  companyId: z.string().uuid("Ongeldige bedrijfs-id."),
  firstName: z
    .string()
    .trim()
    .min(1, "Voornaam is verplicht.")
    .max(120, "Voornaam is te lang."),
  lastName: z
    .string()
    .trim()
    .min(1, "Achternaam is verplicht.")
    .max(120, "Achternaam is te lang."),
  email: optionalEmailSchema,
  phone: z.string().trim().max(40, "Telefoonnummer is te lang.").nullable().optional(),
  jobTitle: z.string().trim().max(200, "Functie is te lang.").nullable().optional(),
  linkedinUrl: optionalUrlSchema,
  source: z.string().trim().max(120, "Bron is te lang.").nullable().optional(),
  confidence: z
    .number()
    .min(0, "Confidence moet tussen 0 en 1 liggen.")
    .max(1, "Confidence moet tussen 0 en 1 liggen.")
    .nullable()
    .optional(),
  lastVerified: z.string().datetime().nullable().optional(),
});

export const listContactsByCompanyInputSchema = z.object({
  companyId: z.string().uuid("Ongeldige bedrijfs-id."),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export const countContactsByCompanyIdsSchema = z.object({
  companyIds: z.array(z.string().uuid()).max(500),
});
