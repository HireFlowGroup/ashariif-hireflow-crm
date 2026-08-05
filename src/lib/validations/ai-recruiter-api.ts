import { z } from "zod";

export const aiRecruiterRunIdParamSchema = z
  .string()
  .uuid("runId moet een geldige UUID zijn.");

export const aiRecruiterParsePlanBodySchema = z.object({
  prompt: z.string().min(10).max(4000),
});

export const aiRecruiterProcessReplyBodySchema = z.object({
  subject: z.string().max(500).nullable().optional(),
  body: z.string().min(1).max(20000),
  companyName: z.string().min(1).max(200),
  contactName: z.string().max(200).nullable().optional(),
  originalSubject: z.string().max(500).nullable().optional(),
  isGeneralMailbox: z.boolean().optional(),
  contactEmail: z.string().email().nullable().optional(),
  outreachMessageId: z.string().uuid().optional(),
  runItemId: z.string().uuid().nullable().optional(),
  persist: z.boolean().optional(),
});
