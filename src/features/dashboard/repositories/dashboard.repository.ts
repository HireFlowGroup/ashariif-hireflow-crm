import type { DashboardFilters, DashboardSnapshot } from "@/features/dashboard/domain/dashboard.types";

export interface DashboardRepository {
  loadSnapshot(organizationId: string, filters: DashboardFilters): Promise<DashboardSnapshot>;
}

export class DashboardRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DashboardRepositoryError";
  }
}
