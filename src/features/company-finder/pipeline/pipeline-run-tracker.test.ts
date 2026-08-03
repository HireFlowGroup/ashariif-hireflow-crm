import { describe, expect, it } from "vitest";

import { PipelineRunTracker } from "@/features/company-finder/pipeline/pipeline-run-tracker";

describe("PipelineRunTracker", () => {
  it("emits snapshot and step lifecycle events", () => {
    const events: string[] = [];
    const tracker = new PipelineRunTracker("job-1", (event) => {
      events.push(event.type);
    });

    tracker.startStep("discovery", { provider: "Brave", message: "Zoeken…" });
    tracker.updateStep("discovery", { resultCount: 5 });
    tracker.completeStep("discovery", { resultCount: 10, message: "Klaar" });

    expect(events).toContain("step_started");
    expect(events).toContain("step_updated");
    expect(events).toContain("step_completed");
    expect(events).toContain("snapshot");

    const discovery = tracker.getSnapshot().find((step) => step.id === "discovery");
    expect(discovery?.status).toBe("completed");
    expect(discovery?.provider).toBe("Brave");
    expect(discovery?.resultCount).toBe(10);
  });
});
