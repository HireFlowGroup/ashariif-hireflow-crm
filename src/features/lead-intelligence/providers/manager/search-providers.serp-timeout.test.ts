import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/lead-intelligence/providers/manager/provider-env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/lead-intelligence/providers/manager/provider-env")>();
  return {
    ...actual,
    getSerpApiKey: () => "test-serp-key",
  };
});

import {
  executeSerpApiSearch,
  resolveSerpApiRequestTimeoutMs,
} from "@/features/lead-intelligence/providers/manager/search-providers";

describe("executeSerpApiSearch timeouts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("resolveSerpApiRequestTimeoutMs prefers explicit request budget", () => {
    expect(resolveSerpApiRequestTimeoutMs(12_000)).toBe(12_000);
  });

  it("aborts hung SerpAPI fetch within the request budget", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const promise = executeSerpApiSearch("test query", 1, 5_000);
    const assertion = expect(promise).rejects.toThrow(/SerpAPI time-out na 5000ms/);

    await vi.advanceTimersByTimeAsync(5_000);

    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});