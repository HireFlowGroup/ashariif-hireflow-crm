import { describe, expect, it } from "vitest";

import { computeSignalFingerprint, mergeIncomingSignals } from "@/features/hiring-intelligence/services/signal-fingerprint";
import type { IncomingHiringSignal } from "@/features/hiring-intelligence/domain/signal-types";

const baseSignal = (overrides: Partial<IncomingHiringSignal> = {}): IncomingHiringSignal => ({
  type: "vacancy",
  title: "HR Manager bij Acme BV",
  description: "Vacature in Amsterdam",
  url: "https://indeed.nl/vacature/123",
  source: "Indeed",
  provider: "indeed",
  confidence: 0.8,
  importance: 85,
  aiRelevance: 70,
  ...overrides,
});

describe("computeSignalFingerprint", () => {
  it("produces stable fingerprints for identical signals", () => {
    const org = "888e4a9d-4432-45b2-b6aa-53725c06c085";
    const a = computeSignalFingerprint(org, baseSignal());
    const b = computeSignalFingerprint(org, baseSignal());
    expect(a).toBe(b);
  });

  it("differs when signal type changes", () => {
    const org = "888e4a9d-4432-45b2-b6aa-53725c06c085";
    const a = computeSignalFingerprint(org, baseSignal({ type: "vacancy" }));
    const b = computeSignalFingerprint(org, baseSignal({ type: "indeed_vacancy" }));
    expect(a).not.toBe(b);
  });
});

describe("mergeIncomingSignals", () => {
  it("merges duplicate signals keeping highest scores", () => {
    const merged = mergeIncomingSignals([
      baseSignal({ confidence: 0.6, importance: 70, aiRelevance: 50 }),
      baseSignal({ confidence: 0.9, importance: 85, aiRelevance: 80, description: "Veel langere beschrijving met extra hiring context" }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.confidence).toBe(0.9);
    expect(merged[0]?.importance).toBe(85);
    expect(merged[0]?.aiRelevance).toBe(80);
    expect(merged[0]?.description).toContain("Veel langere");
  });
});
