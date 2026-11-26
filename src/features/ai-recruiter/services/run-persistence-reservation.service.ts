/**
 * In-application simulation of atomic run caps (P0-R3.1).
 * Production guarantee requires DB function `reserve_ai_recruiter_run_slot` (see migration proposal).
 */

export type RunPersistenceCaps = {
  maximumCompanies: number;
  maximumDrafts: number;
};

export type RunPersistenceReservationState = {
  companiesCommitted: number;
  draftsCommitted: number;
};

export function createRunPersistenceReservationState(): RunPersistenceReservationState {
  return { companiesCommitted: 0, draftsCommitted: 0 };
}

export type RunSlotReservationResult =
  | { reserved: true; state: RunPersistenceReservationState }
  | { reserved: false; state: RunPersistenceReservationState; reason: "company_cap" | "draft_cap" };

export function tryReserveCompanySlot(
  state: RunPersistenceReservationState,
  caps: RunPersistenceCaps,
): RunSlotReservationResult {
  if (state.companiesCommitted >= caps.maximumCompanies) {
    return { reserved: false, state, reason: "company_cap" };
  }
  return {
    reserved: true,
    state: { ...state, companiesCommitted: state.companiesCommitted + 1 },
  };
}

export function tryReserveDraftSlot(
  state: RunPersistenceReservationState,
  caps: RunPersistenceCaps,
): RunSlotReservationResult {
  if (state.draftsCommitted >= caps.maximumDrafts) {
    return { reserved: false, state, reason: "draft_cap" };
  }
  return {
    reserved: true,
    state: { ...state, draftsCommitted: state.draftsCommitted + 1 },
  };
}
