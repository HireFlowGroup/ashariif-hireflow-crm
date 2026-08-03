import type { IncomingHiringSignal } from "@/features/hiring-intelligence/domain/signal-types";
import type { HiringSignal } from "@/types/hiring-intelligence";

export type UpsertHiringSignalInput = {
  organizationId: string;
  jobId?: string | null;
  signal: IncomingHiringSignal;
  fingerprint: string;
  companyId?: string | null;
};

export type UpsertHiringSignalResult = {
  signal: HiringSignal;
  created: boolean;
};

export interface HiringSignalsRepository {
  upsert(input: UpsertHiringSignalInput): Promise<UpsertHiringSignalResult>;
  upsertBatch(inputs: UpsertHiringSignalInput[]): Promise<UpsertHiringSignalResult[]>;
  findByJob(organizationId: string, jobId: string): Promise<HiringSignal[]>;
  findByCompany(organizationId: string, companyId: string): Promise<HiringSignal[]>;
  linkToCompany(organizationId: string, signalId: string, companyId: string): Promise<void>;
}

export class HiringSignalsRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HiringSignalsRepositoryError";
  }
}
