import { z } from "zod";

const factSchema = z.object({
  claim: z.string(),
  sourceUrl: z.string().nullable().optional(),
  sourceType: z.string(),
  confidence: z.coerce.number().min(0).max(1),
});

export const recruitmentOutreachDraftOutputSchema = z.object({
  subject: z.string().min(1),
  salutation: z.string().min(1),
  body: z.string().min(1),
  cta: z.string().min(1),
  closing: z.string().min(1),
  personalizationFacts: z.array(factSchema).default([]),
  sourceEvidence: z.array(factSchema).default([]),
  warnings: z.array(z.string()).default([]),
  confidence: z.coerce.number().min(0).max(1).default(0.5),
});

export type RecruitmentOutreachDraftOutput = z.infer<typeof recruitmentOutreachDraftOutputSchema>;

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function pickArray<T>(record: Record<string, unknown>, keys: string[]): T[] {
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

export function normalizeRecruitmentDraftPayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== "object") return {};
  const record = raw as Record<string, unknown>;

  const subject = pickString(record, ["subject", "subjectLine", "recommendedSubject"]);
  const body = pickString(record, ["body", "bodyText", "emailBody", "content"]);
  const salutation = pickString(record, ["salutation", "greeting"]);
  const cta = pickString(record, ["cta", "callToAction"]);
  const closing = pickString(record, ["closing", "signOff"]);

  return {
    subject,
    salutation,
    body,
    cta,
    closing,
    personalizationFacts: pickArray(record, ["personalizationFacts", "personalization_facts", "factualClaims"]),
    sourceEvidence: pickArray(record, ["sourceEvidence", "source_evidence"]),
    warnings: pickArray<string>(record, ["warnings"]),
    confidence: record.confidence ?? record.confidence_score ?? 0.5,
  };
}

export function parseRecruitmentDraftOutput(raw: unknown): {
  ok: true;
  data: RecruitmentOutreachDraftOutput;
} | {
  ok: false;
  errors: string[];
} {
  const normalized = normalizeRecruitmentDraftPayload(raw);
  const parsed = recruitmentOutreachDraftOutputSchema.safeParse(normalized);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}

export function repairRecruitmentDraftOutput(
  partial: Record<string, unknown>,
  defaults: Partial<RecruitmentOutreachDraftOutput>,
): RecruitmentOutreachDraftOutput {
  const merged = {
    subject: pickString(partial, ["subject", "subjectLine"]) ?? defaults.subject ?? "Ondersteuning bij jullie vacature",
    salutation: pickString(partial, ["salutation", "greeting"]) ?? defaults.salutation ?? "Geachte heer/mevrouw,",
    body: pickString(partial, ["body", "bodyText"]) ?? defaults.body ?? "",
    cta:
      pickString(partial, ["cta", "callToAction"])
      ?? defaults.cta
      ?? "Staat u ervoor open dat wij vrijblijvend geschikte kandidaten voor deze vacature zoeken en aan u voorstellen?",
    closing: pickString(partial, ["closing"]) ?? defaults.closing ?? "Met vriendelijke groet,\nHireFlow Group",
    personalizationFacts: pickArray(partial, ["personalizationFacts", "personalization_facts"]),
    sourceEvidence: pickArray(partial, ["sourceEvidence", "source_evidence"]),
    warnings: pickArray<string>(partial, ["warnings"]),
    confidence: Number(partial.confidence ?? defaults.confidence ?? 0.5),
  };

  return recruitmentOutreachDraftOutputSchema.parse(merged);
}
