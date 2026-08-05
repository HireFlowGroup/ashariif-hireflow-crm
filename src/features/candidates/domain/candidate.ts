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

export type Candidate = {
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

export type CandidateContext = {
  organizationId: string;
  userId: string;
};

export type ListCandidatesInput = {
  limit?: number;
  offset?: number;
  status?: CandidateStatus;
};

export type ListCandidatesResult = {
  candidates: Candidate[];
  total: number;
};
