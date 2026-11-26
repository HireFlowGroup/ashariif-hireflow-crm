/** Hint that a company may be worth investigating — NOT proof of an open vacancy. */

export type HiringSignal = {
  type: string;
  description: string;
  sourceUrl: string | null;
  confidence: number;
  observedAt: string;
};
