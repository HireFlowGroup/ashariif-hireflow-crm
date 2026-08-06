export type IdentityEvidence = {
  type: string;
  value: string;
  url?: string;
  weight: number;
};

export type RejectedName = {
  value: string;
  reason: string;
};

export type OfficialCompanyIdentity = {
  officialName: string | null;
  tradingName: string | null;
  legalName: string | null;
  domain: string | null;
  source: string;
  confidence: number;
  evidence: IdentityEvidence[];
  rejectedNames: RejectedName[];
  unresolved: boolean;
};
