import type { z } from "zod";

/** Shared execution context passed to every tool handler (server-side only). */
export type ToolExecutionContext = {
  userId: string;
  organizationId: string;
};

/** Standard tool result contract (aligned with architecture ToolResult). */
export type ToolResult<TData = unknown> = {
  success: boolean;
  message: string;
  data?: TData;
  companyId?: string;
  company?: unknown;
};

/** HireFlow tool definition bound to a Zod input schema. */
export type HireFlowTool<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  /** OpenAI function name (camelCase). */
  name: string;
  description: string;
  parameters: TSchema;
  /** When true, OpenAI strict JSON schema validation is enabled. */
  strict?: boolean;
  execute: (
    input: z.infer<TSchema>,
    context: ToolExecutionContext,
  ) => Promise<ToolResult>;
};

export type RegisteredTool = HireFlowTool<z.ZodTypeAny>;
