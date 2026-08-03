import type { SupabaseClient } from "@supabase/supabase-js";

import { isFeatureEnabled } from "@/platform/config/feature-flags";
import type { DomainEvent } from "@/platform/events/event-bus";
import { platformEventBus } from "@/platform/events/event-bus";
import { platformLogger } from "@/platform/observability/logger";
import type { Database } from "@/types/database";

export async function persistPlatformEvent(
  client: SupabaseClient<Database>,
  event: DomainEvent,
): Promise<void> {
  if (!isFeatureEnabled("platform_events")) return;

  try {
    const { error } = await client.from("platform_events").insert({
      id: event.id,
      organization_id: event.organizationId,
      event_type: event.type,
      aggregate_type: event.aggregateType,
      aggregate_id: event.aggregateId,
      payload: event.payload,
      version: event.version,
      occurred_at: event.occurredAt,
    });

    if (error) {
      platformLogger.warn("platform_event.persist_failed", { message: error.message });
      return;
    }

    await platformEventBus.publish(event);
  } catch (error) {
    platformLogger.warn("platform_event.persist_error", {
      message: error instanceof Error ? error.message : "unknown",
    });
  }
}
