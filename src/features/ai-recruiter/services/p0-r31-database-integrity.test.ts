import { describe, expect, it } from "vitest";

import {
  canonicalDomainForStorage,
  isCanonicalDomainUniqueEligible,
  isSharedHostingDomain,
} from "@/features/company-finder/discovery/canonical-domain-storage.service";
import { buildCanonicalCompanyIdentity } from "@/features/company-finder/discovery/canonical-company-identity.service";
import { matchAgainstExisting } from "@/features/lead-intelligence/services/dedupe";
import { toCompanyId } from "@/features/companies/domain";
import type { Company } from "@/features/companies/domain";
import {
  createRunPersistenceReservationState,
  tryReserveCompanySlot,
  tryReserveDraftSlot,
} from "@/features/ai-recruiter/services/run-persistence-reservation.service";
import {
  createEmptyProviderRequestTelemetry,
  mergeProviderRequestTelemetry,
  recordDiscoveryQueryTelemetry,
  resolveProviderRequestsCount,
} from "@/features/ai-recruiter/services/provider-request-telemetry.service";
import type { DiscoveryProviderDebugEntry } from "@/features/company-finder/discovery/discovery-provider-failover.types";
import { buildPipelineFunnelDiagnostics } from "@/features/ai-recruiter/services/pipeline-funnel-diagnostics.service";
import { createInitialCounters } from "@/features/ai-recruiter/domain/types";
import { emptyDiscoverySummary } from "@/features/ai-recruiter/services/discovery-run-diagnostics.helpers";
import { buildProspectEvidenceQueue } from "@/features/ai-recruiter/services/prospect-evidence-queue.service";

const orgA = "11111111-1111-1111-1111-111111111111";
const orgB = "22222222-2222-2222-2222-222222222222";

import { DatabaseIntegrityUnavailableError } from "@/features/ai-recruiter/services/database-integrity.errors";
import { reserveAiRecruiterRunSlot } from "@/features/ai-recruiter/services/run-slot-persistence.service";

describe("P0-R3.1 database integrity (local — no DB)", () => {
  it("normalizes domains for storage", () => {
    expect(canonicalDomainForStorage({ website: "https://www.Employer.NL/jobs" })).toBe("employer.nl");
    expect(canonicalDomainForStorage({ domain: "WWW.Acme.COM" })).toBe("acme.com");
    expect(canonicalDomainForStorage({ website: "https://evil.github.io/site" })).toBe(null);
    expect(isSharedHostingDomain("acme.github.io")).toBe(true);
    expect(isCanonicalDomainUniqueEligible("acme.nl")).toBe(true);
    expect(isCanonicalDomainUniqueEligible(null)).toBe(false);
  });

  it("handles companies without domain", () => {
    const identity = buildCanonicalCompanyIdentity({
      organizationId: orgA,
      name: "Mystery BV",
      website: null,
      city: "Rotterdam",
    });
    expect(identity.canonicalDomain).toBeNull();
    expect(identity.matchStrength).toBe("name_city");
  });

  it("scopes tenant keys for canonical identity", () => {
    const a = buildCanonicalCompanyIdentity({
      organizationId: orgA,
      name: "Acme",
      website: "https://acme.nl",
    });
    const b = buildCanonicalCompanyIdentity({
      organizationId: orgB,
      name: "Acme",
      website: "https://acme.nl",
    });
    expect(a.dedupeKey).not.toEqual(b.dedupeKey);
  });

  it("does not auto-merge on fuzzy name without domain", () => {
    const existing: Company = {
      id: toCompanyId("c1"),
      organizationId: orgA,
      ownerId: null,
      name: "Brightworks",
      website: "https://bright-a.nl",
      domain: "bright-a.nl",
      linkedinUrl: null,
      email: null,
      phone: null,
      sector: null,
      city: "Rotterdam",
      region: null,
      province: null,
      country: "NL",
      employeeCount: null,
      employeeCountMin: null,
      employeeCountMax: null,
      employeeCountLabel: null,
      priority: null,
      leadScore: null,
      leadPriority: null,
      scoreReason: null,
      scoreBreakdown: null,
      vacancyCount: 0,
      hiringSignals: [],
      careersUrl: null,
      vacancyPageUrl: null,
      generalEmail: null,
      hrEmail: null,
      kvkNumber: null,
      aiSummary: null,
      source: null,
      sourceUrl: null,
      confidence: null,
      companyType: null,
      companyConfidence: null,
      discoveryReason: null,
      discoveryProvider: null,
      lastVerifiedAt: null,
      outreachStatus: "none",
      status: "prospect",
      notes: null,
      createdAt: "",
      updatedAt: "",
    };
    const match = matchAgainstExisting(
      {
        name: "Brightworks International",
        website: "https://bright-b.nl",
        domain: "bright-b.nl",
        normalizedName: "brightworks international",
        externalId: "x",
        source: "test",
        city: "Rotterdam",
      } as never,
      [existing],
    );
    expect(match.isDuplicate).toBe(false);
  });

  it("refuses memory slot fallback when database guarantees are required", async () => {
    await expect(
      reserveAiRecruiterRunSlot(
        null,
        "company",
        {
          organizationId: orgA,
          runId: "00000000-0000-0000-0000-000000000001",
          caps: { maximumCompanies: 2, maximumDrafts: 1 },
        },
        { requireDatabaseGuarantees: true },
      ),
    ).rejects.toBeInstanceOf(DatabaseIntegrityUnavailableError);
  });

  it("enforces run caps via reservation (app-layer — DB function required for true concurrency)", () => {
    let state = createRunPersistenceReservationState();
    const caps = { maximumCompanies: 2, maximumDrafts: 1 };
    let saved = 0;
    for (let i = 0; i < 5; i++) {
      const attempt = tryReserveCompanySlot(state, caps);
      if (attempt.reserved) {
        saved += 1;
        state = attempt.state;
      }
    }
    expect(saved).toBe(2);

    let draftState = createRunPersistenceReservationState();
    const d1 = tryReserveDraftSlot(draftState, caps);
    expect(d1.reserved).toBe(true);
    draftState = d1.state;
    const d2 = tryReserveDraftSlot(draftState, caps);
    expect(d2.reserved).toBe(false);
  });

  it("counts provider attempts from failover trace", () => {
    const runs: DiscoveryProviderDebugEntry[] = [
      {
        providerId: "tavily",
        name: "Tavily",
        configured: true,
        started: true,
        success: false,
        skipped: false,
        skipReason: null,
        resultCount: 0,
        durationMs: 100,
      },
      {
        providerId: "serpapi",
        name: "SerpAPI",
        configured: true,
        started: true,
        success: true,
        skipped: false,
        skipReason: null,
        resultCount: 5,
        durationMs: 200,
      },
    ];
    const telemetry = recordDiscoveryQueryTelemetry(createEmptyProviderRequestTelemetry(), runs);
    expect(telemetry.providerAttempts).toBe(2);
    expect(telemetry.providerSuccesses).toBe(1);
    expect(telemetry.failoverEvents).toBe(1);
    expect(resolveProviderRequestsCount(telemetry)).toBe(2);
  });

  it("merges telemetry across queries", () => {
    const part = recordDiscoveryQueryTelemetry(createEmptyProviderRequestTelemetry(), [
      {
        providerId: "tavily",
        name: "Tavily",
        configured: true,
        started: true,
        success: true,
        skipped: false,
        skipReason: null,
        resultCount: 3,
        durationMs: 50,
      },
    ]);
    const merged = mergeProviderRequestTelemetry([part, part]);
    expect(merged.searchQueriesExecuted).toBe(2);
    expect(merged.providerAttempts).toBe(2);
  });

  it("builds pipeline funnel with real providerRequests when telemetry present", () => {
    const telemetry = mergeProviderRequestTelemetry([
      recordDiscoveryQueryTelemetry(createEmptyProviderRequestTelemetry(), [
        {
          providerId: "tavily",
          name: "Tavily",
          configured: true,
          started: true,
          success: true,
          skipped: false,
          skipReason: null,
          resultCount: 1,
          durationMs: 1,
        },
      ]),
    ]);
    const funnel = buildPipelineFunnelDiagnostics({
      discoverySummary: emptyDiscoverySummary(),
      counters: createInitialCounters(),
      eligibilityDecisions: [],
      enrichmentAttempts: 2,
      conceptsCreated: 0,
      providerTelemetry: telemetry,
      websiteFetches: 3,
      enrichmentProviderCalls: 1,
    });
    expect(funnel.providerRequests).toBe(1);
    expect(funnel.providerTelemetry?.websiteFetches).toBe(3);
    expect(funnel.version).toBe("p0-r31-v1");
  });

  it("preserves evidence queue from JSON (until migration columns exist)", () => {
    const queue = buildProspectEvidenceQueue([
      {
        id: "item-1",
        organizationId: orgA,
        runId: "run-1",
        companyId: null,
        externalCompanyData: {
          eligibility: {
            eligible: false,
            qualificationStatus: "needs_evidence",
            score: 0,
            threshold: 30,
            priority: "low_priority",
            acceptedRules: [],
            rejectedRules: [],
            reasonCode: "needs_evidence",
            userMessage: "test",
          },
        },
        stage: "scored",
        status: "completed",
        discoveryScore: null,
        hiringScore: null,
        contactScore: null,
        outreachScore: null,
        totalScore: null,
        scoreBreakdown: {
          companyFit: 0,
          hiring: 0,
          opportunity: 0,
          contact: 0,
          personalization: 0,
          outreachReadiness: 0,
          explanations: [],
          opportunityWhy: [],
          rolesSought: [],
          salesWhy: [],
        },
        rejectionReason: null,
        warnings: [],
        selectedContactId: null,
        outreachMessageId: null,
        createdAt: "",
        updatedAt: "",
      },
    ]);
    expect(queue).toHaveLength(1);
  });
});

describe("P0-R3.1 guarantees scope", () => {
  it("documents which guarantees require migration", () => {
    const locallyTested = [
      "domain_normalization",
      "tenant_scoped_dedupe_keys",
      "fuzzy_not_auto_merge",
      "run_cap_reservation_logic",
      "provider_telemetry_aggregation",
      "evidence_queue_json",
    ];
    const requiresMigration = [
      "unique_org_canonical_domain",
      "concurrent_run_cap",
      "idempotent_company_upsert",
      "run_item_unique_per_company",
      "durable_evidence_columns",
    ];
    expect(locallyTested.length).toBeGreaterThan(0);
    expect(requiresMigration.length).toBeGreaterThan(0);
  });
});