import { describe, expect, it } from "vitest";

import { JobDeadline, JobTimeoutError } from "@/features/company-finder/pipeline/pipeline-step-timer";

describe("JobDeadline", () => {
  it("reset gives a fresh phase budget independent of elapsed time in the prior phase", () => {
    const deadline = JobDeadline.fromTimeoutMs(100);

    expect(deadline.remainingMs()).toBeLessThanOrEqual(100);

    deadline.reset(50_000);

    expect(deadline.remainingMs()).toBeGreaterThan(49_000);
    expect(() => deadline.assert("fast_save")).not.toThrow();
  });

  it("assert throws JobTimeoutError with phase name when expired", () => {
    const deadline = new JobDeadline(Date.now() - 1);

    expect(() => deadline.assert("tavily_discovery")).toThrow(JobTimeoutError);
    try {
      deadline.assert("fast_save");
    } catch (error) {
      expect(error).toBeInstanceOf(JobTimeoutError);
      expect((error as JobTimeoutError).phase).toBe("fast_save");
    }
  });
});