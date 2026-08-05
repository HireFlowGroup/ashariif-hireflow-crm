import { z } from "zod";

import {
  aiRecruiterSearchPlanSchema,
  approvalModeSchema,
  outreachModeSchema,
} from "@/features/ai-recruiter/domain/types";

/** Canonical plan schema (domain). Alias for tooling and API docs. */
export const aiRecruiterPlanSchema = aiRecruiterSearchPlanSchema;

export type AiRecruiterPlan = z.infer<typeof aiRecruiterPlanSchema>;

const DEFAULT_CONTACT_ROLES = [
  "Recruitment Manager",
  "Talent Acquisition",
  "HR Manager",
  "HR Business Partner",
  "Directeur",
] as const;

function coerceNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) return Math.round(parsed);
  }
  return null;
}

function coerceInt(value: unknown, fallback: number): number {
  const nullable = coerceNullableInt(value);
  return nullable ?? fallback;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

function coerceBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/** Raw structured output from OpenAI — validated before sanitization. */
export const aiRecruiterSearchPlanRawSchema = z.object({
  locations: z.array(z.string()).optional(),
  regions: z.array(z.string()).optional(),
  sectors: z.array(z.string()).optional(),
  employee_range: z
    .object({
      min: z.union([z.number(), z.string(), z.null()]).optional(),
      max: z.union([z.number(), z.string(), z.null()]).optional(),
    })
    .optional(),
  desired_roles: z.array(z.string()).optional(),
  vacancy_required: z.union([z.boolean(), z.string()]).optional(),
  minimum_hiring_score: z.union([z.number(), z.string()]).optional(),
  maximum_companies: z.union([z.number(), z.string(), z.null()]).optional(),
  maximum_drafts: z.union([z.number(), z.string(), z.null()]).optional(),
  contact_roles: z.array(z.string()).optional(),
  outreach_mode: z.string().optional(),
  approval_mode: z.string().optional(),
  exclusions: z.array(z.string()).optional(),
  uncertainties: z.array(z.string()).optional(),
  reasoning: z.string().optional(),
});

export type AiRecruiterSearchPlanRaw = z.infer<typeof aiRecruiterSearchPlanRawSchema>;

export function sanitizeAiRecruiterSearchPlan(raw: AiRecruiterSearchPlanRaw): AiRecruiterPlan {
  const outreachModeResult = outreachModeSchema.safeParse(raw.outreach_mode);
  const approvalModeResult = approvalModeSchema.safeParse(raw.approval_mode);

  const normalized = {
    locations: coerceStringArray(raw.locations),
    regions: coerceStringArray(raw.regions),
    sectors: coerceStringArray(raw.sectors),
    employee_range: {
      min: coerceNullableInt(raw.employee_range?.min),
      max: coerceNullableInt(raw.employee_range?.max),
    },
    desired_roles: coerceStringArray(raw.desired_roles),
    vacancy_required: coerceBoolean(raw.vacancy_required),
    minimum_hiring_score: Math.min(100, Math.max(0, coerceInt(raw.minimum_hiring_score, 40))),
    maximum_companies: Math.min(100, Math.max(1, coerceInt(raw.maximum_companies, 25))),
    maximum_drafts: Math.min(50, Math.max(0, coerceInt(raw.maximum_drafts, 10))),
    contact_roles:
      coerceStringArray(raw.contact_roles).length > 0
        ? coerceStringArray(raw.contact_roles)
        : [...DEFAULT_CONTACT_ROLES],
    outreach_mode: outreachModeResult.success ? outreachModeResult.data : "draft_only",
    approval_mode: approvalModeResult.success ? approvalModeResult.data : "manual",
    exclusions: coerceStringArray(raw.exclusions),
    uncertainties: coerceStringArray(raw.uncertainties),
    reasoning: typeof raw.reasoning === "string" ? raw.reasoning.trim() : "",
  };

  return aiRecruiterPlanSchema.parse(normalized);
}

/** Input for creating a recruiter run (API + UI). */
export const aiRecruiterRunSchema = z.object({
  name: z.string().min(1).max(200),
  prompt: z.string().min(10).max(4000),
  searchPlan: aiRecruiterPlanSchema,
});

export type AiRecruiterRunInput = z.infer<typeof aiRecruiterRunSchema>;
