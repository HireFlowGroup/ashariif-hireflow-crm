import { z } from "zod";

export type CandidateId = string & { readonly __brand: "CandidateId" };

export function toCandidateId(value: string): CandidateId {
  return value as CandidateId;
}

export type CandidateStatus =
  | "new"
  | "screening"
  | "interview"
  | "offer"
  | "hired"
  | "rejected";

export type CandidateProfile = {
  id: CandidateId;
  organizationId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: CandidateStatus;
  currentRole: string | null;
  location: string | null;
  summary: string | null;
  skills: string[];
  experienceYears: number | null;
  salaryExpectationMin: number | null;
  salaryExpectationMax: number | null;
  availability: string | null;
  ownerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CandidateMatchContext = {
  organizationId: string;
  userId: string;
};

/** Inline profile for matching when candidate is not yet in CRM. */
export type CandidateMatchInput = {
  firstName: string;
  lastName: string;
  currentRole?: string | null;
  location?: string | null;
  summary?: string | null;
  skills?: string[];
  experienceYears?: number | null;
  salaryExpectationMin?: number | null;
  salaryExpectationMax?: number | null;
  availability?: string | null;
};

export const candidateMatchInputSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  currentRole: z.string().max(200).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  summary: z.string().max(5000).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  experienceYears: z.number().int().min(0).max(60).nullable().optional(),
  salaryExpectationMin: z.number().int().min(0).nullable().optional(),
  salaryExpectationMax: z.number().int().min(0).nullable().optional(),
  availability: z.string().max(200).nullable().optional(),
});

export const candidateMatchBreakdownSchema = z.object({
  roleFit: z.number().min(0).max(25),
  skillsFit: z.number().min(0).max(30),
  locationFit: z.number().min(0).max(15),
  experienceFit: z.number().min(0).max(15),
  salaryFit: z.number().min(0).max(15),
});

export type CandidateMatchBreakdown = z.infer<typeof candidateMatchBreakdownSchema>;

export const candidateMatchResultSchema = z.object({
  matchScore: z.number().min(0).max(100),
  breakdown: candidateMatchBreakdownSchema,
  strongPoints: z.array(z.string()),
  risks: z.array(z.string()),
  salaryExpectation: z.string(),
  availability: z.string(),
  missingInfo: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export type CandidateMatchResult = z.infer<typeof candidateMatchResultSchema>;

export const candidateIntroductionSchema = z.object({
  bodyText: z.string(),
  wordCount: z.number().int().min(0),
  confidence: z.number().min(0).max(1),
});

export type CandidateIntroduction = z.infer<typeof candidateIntroductionSchema>;

export const candidateVacancyMatchSchema = z.object({
  vacancyId: z.string(),
  vacancyTitle: z.string(),
  candidateName: z.string(),
  match: candidateMatchResultSchema,
  introduction: candidateIntroductionSchema,
});

export type CandidateVacancyMatch = z.infer<typeof candidateVacancyMatchSchema>;
