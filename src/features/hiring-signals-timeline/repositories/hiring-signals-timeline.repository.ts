import type { HiringSignalType } from "@/features/hiring-intelligence/domain/signal-types";
import type { CompanyScore, HiringSignal } from "@/types/hiring-intelligence";

export type FindSignalsOptions = {
  signalTypes?: HiringSignalType[] | null;
  limit?: number;
};

export interface HiringSignalsTimelineRepository {
  findSignalsByCompany(
    organizationId: string,
    companyId: string,
    options?: FindSignalsOptions,
  ): Promise<HiringSignal[]>;

  findScoreHistory(
    organizationId: string,
    companyId: string,
    limit?: number,
  ): Promise<CompanyScore[]>;

  getTimelineWatermark(organizationId: string, companyId: string): Promise<string>;
}

export class HiringSignalsTimelineRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HiringSignalsTimelineRepositoryError";
  }
}
