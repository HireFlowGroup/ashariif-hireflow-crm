/** @deprecated Import from stream-events-core or stream-sse */
export * from "@/lib/company-finder/stream-events-core";

export function encodeFinderStreamEvent(
  event: import("@/lib/company-finder/stream-events-core").FinderStreamEvent,
): string {
  return `${JSON.stringify(event)}\n`;
}
