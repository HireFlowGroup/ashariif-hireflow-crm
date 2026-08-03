import { z } from "zod";

export const createContactSearchJobSchema = z.object({
  companyId: z.string().uuid("Ongeldige bedrijfs-id."),
  targetRoles: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
});

export const contactSearchJobIdSchema = z.object({
  jobId: z.string().uuid("Ongeldige job-id."),
});
