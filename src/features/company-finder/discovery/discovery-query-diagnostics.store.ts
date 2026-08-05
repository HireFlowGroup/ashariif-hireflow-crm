import type { DiscoveryQueryDiagnostic } from "@/features/company-finder/services/fast-discovery.service";

export type StoredDiscoveryQueryRun = {
  jobId: string;
  organizationId: string | null;
  providerId: string;
  totalRawResults: number;
  classifiedCounts: Record<string, number>;
  queries: DiscoveryQueryDiagnostic[];
  recordedAt: string;
};

const MAX_ENTRIES = 50;
const byJobId = new Map<string, StoredDiscoveryQueryRun>();
const order: string[] = [];

function trim(): void {
  while (order.length > MAX_ENTRIES) {
    const oldest = order.shift();
    if (oldest) byJobId.delete(oldest);
  }
}

export function recordDiscoveryQueryRun(input: StoredDiscoveryQueryRun): void {
  byJobId.set(input.jobId, input);
  if (!order.includes(input.jobId)) {
    order.unshift(input.jobId);
  }
  trim();
}

export function getDiscoveryQueryRun(jobId: string): StoredDiscoveryQueryRun | null {
  return byJobId.get(jobId) ?? null;
}

export function listDiscoveryQueryRuns(limit = 20): StoredDiscoveryQueryRun[] {
  return order
    .slice(0, limit)
    .map((jobId) => byJobId.get(jobId))
    .filter((entry): entry is StoredDiscoveryQueryRun => Boolean(entry));
}
