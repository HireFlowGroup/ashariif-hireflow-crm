import { z } from "zod";

export const aiRecruiterRunIdParamSchema = z
  .string()
  .uuid("runId moet een geldige UUID zijn.");

export const aiRecruiterParsePlanBodySchema = z.object({
  prompt: z.string().min(10).max(4000),
});
