/**
 * Central defaults for the HireFlow AI runtime.
 * Override at call sites only when a use case explicitly requires it.
 */

/** Primary model for assistant responses (cost-effective, capable). */
export const DEFAULT_MODEL = "gpt-4o-mini" as const;

/** Keeps answers stable and factual; suitable before tool calling is enabled. */
export const DEFAULT_TEMPERATURE = 0.4;

/** Prevents runaway generations while allowing substantive recruitment answers. */
export const MAX_OUTPUT_TOKENS = 2048;
