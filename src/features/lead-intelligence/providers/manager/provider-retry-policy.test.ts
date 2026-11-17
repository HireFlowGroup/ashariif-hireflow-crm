import { describe, expect, it } from "vitest";

import {
  parseHttpStatusFromProviderMessage,
  resolveProviderRetryDecision,
} from "@/features/lead-intelligence/providers/manager/provider-retry-policy";

describe("parseHttpStatusFromProviderMessage", () => {
  it("extracts status from provider error strings", () => {
    expect(parseHttpStatusFromProviderMessage("Tavily HTTP 432: quota")).toBe(432);
    expect(parseHttpStatusFromProviderMessage("SerpAPI HTTP 503: unavailable")).toBe(503);
  });
});

describe("resolveProviderRetryDecision", () => {
  const maxRetries = 2;

  it("does not retry Tavily HTTP 432 usage limit", () => {
    const decision = resolveProviderRetryDecision("Tavily HTTP 432: usage limit", 0, maxRetries);
    expect(decision.allowRetry).toBe(false);
  });

  it("does not retry HTTP 401/403", () => {
    expect(resolveProviderRetryDecision("SerpAPI HTTP 401: unauthorized", 0, maxRetries).allowRetry).toBe(false);
    expect(resolveProviderRetryDecision("Brave Search HTTP 403: forbidden", 0, maxRetries).allowRetry).toBe(false);
  });

  it("allows one retry for HTTP 503 then stops", () => {
    const first = resolveProviderRetryDecision("SerpAPI HTTP 503: overloaded", 0, maxRetries);
    expect(first.allowRetry).toBe(true);
    expect(first.backoffMs).toBe(1500);

    const second = resolveProviderRetryDecision("SerpAPI HTTP 503: overloaded", 1, maxRetries);
    expect(second.allowRetry).toBe(false);
  });

  it("does not retry client timeouts", () => {
    expect(resolveProviderRetryDecision("SerpAPI time-out na 20000ms", 0, maxRetries).allowRetry).toBe(false);
    expect(resolveProviderRetryDecision("Timeout na 18000ms", 0, maxRetries).allowRetry).toBe(false);
  });

  it("allows default retries for other errors", () => {
    expect(resolveProviderRetryDecision("SerpAPI HTTP 500: internal", 0, maxRetries).allowRetry).toBe(true);
    expect(resolveProviderRetryDecision("SerpAPI HTTP 500: internal", 2, maxRetries).allowRetry).toBe(false);
  });
});