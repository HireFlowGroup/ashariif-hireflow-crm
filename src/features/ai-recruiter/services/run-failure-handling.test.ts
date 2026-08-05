import { describe, expect, it } from "vitest";

import { createInitialPipelineSteps } from "@/features/ai-recruiter/domain/types";
import { createEmptyRunDiagnostics } from "@/features/ai-recruiter/domain/run-diagnostics";
import {
  buildDiscoveryDiagnostics,
  buildRunFailureUiMessage,
  classifyProviderError,
  emptyDiscoverySummary,
} from "@/features/ai-recruiter/services/discovery-run-diagnostics.service";
import {
  discoveryStepFailed,
  resolveRunOutcome,
} from "@/features/ai-recruiter/services/run-outcome.service";
import { RecruiterPipelineTracker } from "@/features/ai-recruiter/services/recruiter-pipeline-tracker";
import { skipEnrichmentAndDownstream } from "@/features/ai-recruiter/services/run-session.helpers";
import { aiRecruiterSearchPlanSchema } from "@/features/ai-recruiter/domain/types";

const plan = aiRecruiterSearchPlanSchema.parse({
  locations: ["Rotterdam"],
  sectors: ["SaaS"],
  employee_range: { min: 20, max: 200 },
  desired_roles: ["recruiter"],
  maximum_companies: 10,
  maximum_drafts: 5,
});

describe("classifyProviderError", () => {
  it("classifies provider not configured", () => {
    expect(classifyProviderError("Geen actieve zoekproviders. Configureer minimaal één search API key.")).toBe(
      "provider_not_configured",
    );
  });

  it("classifies 401 auth failure", () => {
    expect(classifyProviderError("Unauthorized invalid api key", 401)).toBe("provider_auth_failed");
  });

  it("classifies 429 rate limit", () => {
    expect(classifyProviderError("Rate limit exceeded", 429)).toBe("provider_rate_limited");
  });

  it("classifies timeout", () => {
    expect(classifyProviderError("Tavily discovery time-out na 10000ms")).toBe("provider_timeout");
  });

  it("classifies database errors", () => {
    expect(classifyProviderError("Bedrijf kon niet worden opgeslagen in supabase")).toBe("database_error");
  });
});

describe("buildDiscoveryDiagnostics", () => {
  it("marks successful search with zero results as no_results", () => {
    const diagnostics = buildDiscoveryDiagnostics({
      plan,
      job: {
        id: "job-1",
        status: "failed",
        errorMessage: "Geen bedrijven opgeslagen na Tavily discovery.",
        foundCount: 0,
        savedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        providerErrors: [],
      } as never,
      summary: { ...emptyDiscoverySummary(), responseCount: 0, providerName: "tavily" },
      durationMs: 1200,
      validatedCount: 0,
    });

    expect(diagnostics.errorCode).toBe("no_results");
    expect(discoveryStepFailed(diagnostics.errorCode)).toBe(false);
  });

  it("marks rejected urls as no_valid_companies", () => {
    const diagnostics = buildDiscoveryDiagnostics({
      plan,
      job: {
        id: "job-1",
        status: "failed",
        errorMessage: "Geen bedrijven opgeslagen: 12 URLs afgewezen",
        foundCount: 12,
        savedCount: 0,
        skippedCount: 12,
        errorCount: 0,
        providerErrors: [],
      } as never,
      summary: {
        ...emptyDiscoverySummary(),
        responseCount: 12,
        rejectedCount: 12,
        providerName: "tavily",
        rejectionReasons: ["12 afgewezen door heuristieken"],
      },
      durationMs: 900,
      validatedCount: 0,
    });

    expect(diagnostics.errorCode).toBe("no_valid_companies");
  });

  it("marks provider failures as failed discovery", () => {
    const diagnostics = buildDiscoveryDiagnostics({
      plan,
      job: null,
      summary: {
        ...emptyDiscoverySummary(),
        lastErrorMessage: "Unauthorized invalid api key",
        providerName: "tavily",
      },
      durationMs: 400,
      validatedCount: 0,
    });

    expect(diagnostics.errorCode).toBe("provider_auth_failed");
    expect(discoveryStepFailed(diagnostics.errorCode)).toBe(true);
  });
});

describe("resolveRunOutcome", () => {
  it("returns failed for provider errors", () => {
    const diagnostics = createEmptyRunDiagnostics();
    diagnostics.errorCode = "provider_auth_failed";
    diagnostics.errorMessage = "Auth mislukt";

    const outcome = resolveRunOutcome({
      counters: { found: 0, validated: 0, withVacancies: 0, withSignals: 0, contactFound: 0, generalMailboxFound: 0, blockedMissingContact: 0, draftsCreated: 0, approved: 0, sent: 0, failed: 0, skipped: 0, replies: 0 },
      diagnostics,
      draftsCreated: 0,
    });

    expect(outcome.status).toBe("failed");
  });

  it("returns partially_completed when validated but no drafts", () => {
    const diagnostics = createEmptyRunDiagnostics();
    const outcome = resolveRunOutcome({
      counters: { found: 5, validated: 3, withVacancies: 2, withSignals: 1, contactFound: 0, generalMailboxFound: 0, blockedMissingContact: 3, draftsCreated: 0, approved: 0, sent: 0, failed: 0, skipped: 2, replies: 0 },
      diagnostics,
      draftsCreated: 0,
    });

    expect(outcome.status).toBe("partially_completed");
    expect(outcome.errorMessage).toContain("Geen concepten");
  });
});

describe("RecruiterPipelineTracker terminal runs", () => {
  it("has no pending steps after finalizeTerminalRun", () => {
    const tracker = new RecruiterPipelineTracker(createInitialPipelineSteps(), () => undefined);
    tracker.startStep("discovery");
    tracker.failStep("discovery", "Provider timeout", { processed: 0, errors: 1 });
    skipEnrichmentAndDownstream(tracker, "Geen bedrijven");
    tracker.finalizeTerminalRun();

    const snapshot = tracker.getSnapshot();
    expect(snapshot.some((step) => step.status === "pending")).toBe(false);
    expect(snapshot.some((step) => step.status === "running")).toBe(false);
    expect(snapshot.find((step) => step.id === "discovery")?.status).toBe("failed");
    expect(snapshot.find((step) => step.id === "vacancies")?.status).toBe("skipped");
    expect(snapshot.find((step) => step.id === "crawler")?.status).toBe("skipped");
    expect(snapshot.find((step) => step.id === "ai_analysis")?.status).toBe("skipped");
  });

  it("skips downstream steps without input", () => {
    const tracker = new RecruiterPipelineTracker(createInitialPipelineSteps(), () => undefined);
    tracker.startStep("discovery");
    tracker.completeStep("discovery", { processed: 0, succeeded: 0, skipped: 0 });
    skipEnrichmentAndDownstream(tracker, "Geen bedrijven om te verwerken");
    tracker.finalizeTerminalRun();

    expect(tracker.getSnapshot().find((s) => s.id === "contact_finder")?.status).toBe("skipped");
    expect(tracker.hasPendingOrRunningSteps()).toBe(false);
  });
});

describe("buildRunFailureUiMessage", () => {
  it("shows provider settings link for not configured", () => {
    const diagnostics = createEmptyRunDiagnostics();
    diagnostics.errorCode = "provider_not_configured";
    diagnostics.errorMessage = "TAVILY_API_KEY niet geconfigureerd";
    diagnostics.providerName = "tavily";
    diagnostics.providerActive = false;

    const ui = buildRunFailureUiMessage(diagnostics, "failed");
    expect(ui?.showProviderSettings).toBe(true);
    expect(ui?.body).toContain("tavily");
  });

  it("shows no results guidance", () => {
    const diagnostics = createEmptyRunDiagnostics();
    diagnostics.errorCode = "no_results";
    diagnostics.errorMessage = "De zoekopdracht leverde geen bedrijven op.";

    const ui = buildRunFailureUiMessage(diagnostics, "failed");
    expect(ui?.body).toContain("locatie, branche");
    expect(ui?.retryRecommended).toBe(true);
  });
});
