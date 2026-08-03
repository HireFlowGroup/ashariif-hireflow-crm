import type { DashboardFilters, DashboardSnapshot } from "@/features/dashboard/domain/dashboard.types";
import type { DashboardRepository } from "@/features/dashboard/repositories/dashboard.repository";

export type DashboardServiceContext = {
  organizationId: string;
  userId: string;
};

export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getSnapshot(
    context: DashboardServiceContext,
    filters: DashboardFilters,
  ): Promise<DashboardSnapshot> {
    return this.repository.loadSnapshot(context.organizationId, filters);
  }
}
