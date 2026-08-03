import { createHash } from "crypto";

import type { IncomingHiringSignal } from "@/features/hiring-intelligence/domain/signal-types";

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Stable deduplication fingerprint per organization. */
export function computeSignalFingerprint(
  organizationId: string,
  signal: Pick<
    IncomingHiringSignal,
    "type" | "url" | "title" | "provider" | "externalId" | "companyHint"
  >,
): string {
  const parts = [
    organizationId,
    signal.type,
    signal.provider,
    normalize(signal.externalId),
    normalize(signal.url),
    normalize(signal.title),
    normalize(signal.companyHint?.domain),
    normalize(signal.companyHint?.normalizedName ?? signal.companyHint?.name),
  ].join("|");

  return createHash("sha256").update(parts).digest("hex");
}

export function mergeIncomingSignals(signals: IncomingHiringSignal[]): IncomingHiringSignal[] {
  const byFingerprint = new Map<string, IncomingHiringSignal>();

  for (const signal of signals) {
    const key = [
      signal.type,
      signal.provider,
      normalize(signal.externalId),
      normalize(signal.url),
      normalize(signal.title),
    ].join("|");

    const existing = byFingerprint.get(key);

    if (!existing) {
      byFingerprint.set(key, signal);
      continue;
    }

    byFingerprint.set(key, {
      ...existing,
      description:
        signal.description.length > existing.description.length
          ? signal.description
          : existing.description,
      confidence: Math.max(existing.confidence, signal.confidence),
      importance: Math.max(existing.importance, signal.importance),
      aiRelevance: Math.max(existing.aiRelevance, signal.aiRelevance),
      extractedFields: { ...existing.extractedFields, ...signal.extractedFields },
      payload: { ...existing.payload, ...signal.payload },
    });
  }

  return [...byFingerprint.values()];
}
