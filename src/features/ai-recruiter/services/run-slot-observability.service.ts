import { pipelineDebug } from "@/features/lead-intelligence/debug/pipeline-debug";

export type RunSlotAuditEvent = {
  runId: string;
  organizationId: string;
  slot: "company" | "draft";
  action: "reserve" | "release";
  reserved: boolean;
  backend: "database" | "memory";
};

export function auditRunSlotReservation(event: RunSlotAuditEvent): void {
  pipelineDebug("ai_recruiter.run_slot", {
    ...event,
    guarantees: event.backend === "database" ? "db_backed" : "memory_fallback",
  });
}

export function validateSlotSaveConsistency(input: {
  companiesReserved: number;
  companiesSaved: number;
  draftsReserved: number;
  draftsCreated: number;
}): { ok: boolean; detail: string } {
  if (input.companiesSaved > input.companiesReserved) {
    return {
      ok: false,
      detail: `save_count (${input.companiesSaved}) > reserved_slots (${input.companiesReserved})`,
    };
  }
  if (input.draftsCreated > input.draftsReserved) {
    return {
      ok: false,
      detail: `draft_count (${input.draftsCreated}) > reserved_slots (${input.draftsReserved})`,
    };
  }
  return { ok: true, detail: "slot_save_consistent" };
}