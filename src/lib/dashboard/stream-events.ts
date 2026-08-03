import type { DashboardSnapshot } from "@/features/dashboard/domain/dashboard.types";

export const DASHBOARD_STREAM_FORMAT_HEADER = "X-Dashboard-Stream-Format";
export const DASHBOARD_STREAM_FORMAT_NDJSON = "ndjson-v1";

export type DashboardStreamSnapshotEvent = {
  type: "snapshot";
  snapshot: DashboardSnapshot;
};

export type DashboardStreamHeartbeatEvent = {
  type: "heartbeat";
  at: string;
};

export type DashboardStreamErrorEvent = {
  type: "error";
  message: string;
};

export type DashboardStreamEvent =
  | DashboardStreamSnapshotEvent
  | DashboardStreamHeartbeatEvent
  | DashboardStreamErrorEvent;

export function encodeDashboardStreamEvent(event: DashboardStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}
