export class DatabaseIntegrityUnavailableError extends Error {
  constructor(
    message: string,
    readonly code:
      | "missing_supabase_client"
      | "missing_rpc_function"
      | "rpc_failed"
      | "slot_not_reserved" = "missing_rpc_function",
  ) {
    super(message);
    this.name = "DatabaseIntegrityUnavailableError";
  }
}