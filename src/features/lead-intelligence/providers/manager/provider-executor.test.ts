import { describe, expect, it, vi } from "vitest";

import { executeWithResilience } from "@/features/lead-intelligence/providers/manager/provider-executor";

describe("executeWithResilience retry policy", () => {
  it("does not retry after Tavily HTTP 432", async () => {
    const fn = vi.fn().mockRejectedValue(new Error("Tavily HTTP 432: usage limit"));

    await expect(
      executeWithResilience(
        {
          providerId: "tavily",
          timeoutMs: 5_000,
          maxRetries: 2,
          rateLimitPerMinute: 60,
          useCache: false,
        },
        fn,
      ),
    ).rejects.toThrow(/432/);

    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries SerpAPI HTTP 503 once then stops", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("SerpAPI HTTP 503: overloaded"))
      .mockResolvedValueOnce({
        data: [{ title: "Ok", url: "https://example.com", description: "" }],
        responseSize: 10,
      });

    vi.useFakeTimers();
    const promise = executeWithResilience(
      {
        providerId: "serpapi",
        timeoutMs: 5_000,
        maxRetries: 2,
        rateLimitPerMinute: 60,
        useCache: false,
      },
      fn,
    );

    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;
    vi.useRealTimers();

    expect(result.data).toHaveLength(1);
    expect(fn).toHaveBeenCalledTimes(2);
  });
});