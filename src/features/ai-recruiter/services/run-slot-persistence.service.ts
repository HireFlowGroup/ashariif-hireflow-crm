import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRunPersistenceReservationState,
  tryReserveCompanySlot,
  tryReserveDraftSlot,
  type RunPersistenceCaps,
  type RunPersistenceReservationState,
} from "@/features/ai-recruiter/services/run-persistence-reservation.service";
import { DatabaseIntegrityUnavailableError } from "@/features/ai-recruiter/services/database-integrity.errors";
import { auditRunSlotReservation } from "@/features/ai-recruiter/services/run-slot-observability.service";

export type RunSlotType = "company" | "draft";

export type RunSlotReservationContext = {
  organizationId: string;
  runId: string;
  caps: RunPersistenceCaps;
};

const inMemoryRunSlots = new Map<string, RunPersistenceReservationState>();

function memoryKey(organizationId: string, runId: string): string {
  return `${organizationId}::${runId}`;
}

function reserveInMemory(slot: RunSlotType, ctx: RunSlotReservationContext): boolean {
  const key = memoryKey(ctx.organizationId, ctx.runId);
  const state = inMemoryRunSlots.get(key) ?? createRunPersistenceReservationState();
  const attempt =
    slot === "company"
      ? tryReserveCompanySlot(state, ctx.caps)
      : tryReserveDraftSlot(state, ctx.caps);
  if (!attempt.reserved) return false;
  inMemoryRunSlots.set(key, attempt.state);
  return true;
}

function releaseInMemory(slot: RunSlotType, ctx: Pick<RunSlotReservationContext, "organizationId" | "runId">): void {
  const key = memoryKey(ctx.organizationId, ctx.runId);
  const state = inMemoryRunSlots.get(key) ?? createRunPersistenceReservationState();
  if (slot === "company" && state.companiesCommitted > 0) {
    inMemoryRunSlots.set(key, { ...state, companiesCommitted: state.companiesCommitted - 1 });
  }
  if (slot === "draft" && state.draftsCommitted > 0) {
    inMemoryRunSlots.set(key, { ...state, draftsCommitted: state.draftsCommitted - 1 });
  }
}

export type RunSlotPersistenceOptions = {
  /** When true, never fall back to in-memory caps (AI Recruiter persistence). */
  requireDatabaseGuarantees?: boolean;
};

export async function reserveAiRecruiterRunSlot(
  client: SupabaseClient | null,
  slot: RunSlotType,
  ctx: RunSlotReservationContext,
  options?: RunSlotPersistenceOptions,
): Promise<{ reserved: boolean; backend: "database" | "memory" }> {
  const requireDb = options?.requireDatabaseGuarantees === true;

  if (requireDb && !client) {
    throw new DatabaseIntegrityUnavailableError(
      "Database-slotreservering vereist maar er is geen Supabase-client.",
      "missing_supabase_client",
    );
  }

  if (client) {
    const { data, error } = await client.rpc("reserve_ai_recruiter_run_slot", {
      p_run_id: ctx.runId,
      p_organization_id: ctx.organizationId,
      p_slot: slot,
      p_max: slot === "company" ? ctx.caps.maximumCompanies : ctx.caps.maximumDrafts,
    });

    if (!error) {
      const reserved = data === true;
      auditRunSlotReservation({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        slot,
        action: "reserve",
        reserved,
        backend: "database",
      });
      return { reserved, backend: "database" };
    }

    const missingFn =
      error.code === "PGRST202"
      || /could not find the function/i.test(error.message ?? "");

    if (!missingFn) {
      throw new Error(error.message ?? "Slotreservering mislukt");
    }

    if (requireDb) {
      throw new DatabaseIntegrityUnavailableError(
        "reserve_ai_recruiter_run_slot ontbreekt op de database — AI Recruiter persistence gestopt.",
        "missing_rpc_function",
      );
    }
  }

  if (requireDb) {
    throw new DatabaseIntegrityUnavailableError(
      "Database-slotreservering vereist maar RPC niet beschikbaar.",
      "missing_rpc_function",
    );
  }

  const reserved = reserveInMemory(slot, ctx);
  auditRunSlotReservation({
    runId: ctx.runId,
    organizationId: ctx.organizationId,
    slot,
    action: "reserve",
    reserved,
    backend: "memory",
  });
  return {
    reserved,
    backend: "memory",
  };
}

export async function releaseAiRecruiterRunSlot(
  client: SupabaseClient | null,
  slot: RunSlotType,
  ctx: Pick<RunSlotReservationContext, "organizationId" | "runId">,
  options?: RunSlotPersistenceOptions,
): Promise<void> {
  const requireDb = options?.requireDatabaseGuarantees === true;

  if (client) {
    const { error } = await client.rpc("release_ai_recruiter_run_slot", {
      p_run_id: ctx.runId,
      p_organization_id: ctx.organizationId,
      p_slot: slot,
    });
    if (!error) {
      auditRunSlotReservation({
        runId: ctx.runId,
        organizationId: ctx.organizationId,
        slot,
        action: "release",
        reserved: true,
        backend: "database",
      });
      return;
    }
    const missingFn =
      error.code === "PGRST202"
      || /could not find the function/i.test(error.message ?? "");
    if (!missingFn) {
      throw new Error(error.message ?? "Slot vrijgave mislukt");
    }

    if (requireDb) {
      throw new DatabaseIntegrityUnavailableError(
        "release_ai_recruiter_run_slot ontbreekt op de database.",
        "missing_rpc_function",
      );
    }
  }

  if (requireDb) {
    return;
  }

  releaseInMemory(slot, ctx);
}

/** Test helper — reset in-memory coordinator. */
export function resetInMemoryRunSlotsForTests(): void {
  inMemoryRunSlots.clear();
}