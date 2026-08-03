import { describe, expect, it } from "vitest";

import { runWithConcurrency } from "@/lib/async/run-with-concurrency";

describe("runWithConcurrency", () => {
  it("runs tasks in parallel up to the concurrency limit", async () => {
    const startedAt: number[] = [];
    const tasks = Array.from({ length: 4 }, (_, index) => async () => {
      startedAt.push(Date.now());
      await new Promise((resolve) => setTimeout(resolve, 20));
      return index;
    });

    const results = await runWithConcurrency(tasks, 2);
    expect(results).toEqual([0, 1, 2, 3]);
    expect(startedAt.length).toBe(4);
  });
});
