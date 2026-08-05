import { describe, expect, it } from "vitest";

import {
  classifyReply,
  classifyReplyWithConfidence,
  getReplyFollowUpAction,
} from "@/features/ai-recruiter/services/reply-classifier.service";
import { generateSuggestedReply } from "@/features/ai-recruiter/services/reply-response-generator.service";
import { processIncomingReply } from "@/features/ai-recruiter/services/incoming-reply.service";

const baseContext = {
  companyName: "ScaleUp BV",
  contactName: "Sanne",
  originalSubject: "Kennismaking — ScaleUp BV",
  replySubject: "Re: Kennismaking — ScaleUp BV",
  replyBody: "",
  contactEmail: "sanne@scaleup.nl",
};

describe("reply classification with confidence", () => {
  it("classifies interest with high confidence", () => {
    const result = classifyReplyWithConfidence(
      "Re: Kennismaking",
      "Graag een afspraak volgende week om te kennismaken.",
    );
    expect(result.classification).toBe("interesse");
    expect(result.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("classifies new assignment", () => {
    const result = classifyReplyWithConfidence(
      "Samenwerking recruitment",
      "We zoeken een recruitment partner voor drie vacatures. Kunnen jullie helpen met inhuur?",
    );
    expect(result.classification).toBe("nieuwe_opdracht");
  });

  it("classifies later", () => {
    expect(classifyReply(null, "Interessant, maar niet nu — volgende maand misschien")).toBe("later");
  });

  it("classifies rejection / opt-out", () => {
    expect(classifyReply(null, "Please unsubscribe me from this list")).toBe("afgewezen");
  });

  it("classifies out of office", () => {
    const result = classifyReplyWithConfidence("Out of office", "Ik ben afwezig tot 12 augustus.");
    expect(result.classification).toBe("out_of_office");
  });

  it("classifies auto reply / bounce", () => {
    expect(classifyReply("Delivery failed", "Undeliverable")).toBe("automatisch_antwoord");
  });

  it("classifies spam", () => {
    expect(classifyReply("SEO offer", "Buy viagra and crypto now")).toBe("spam");
  });
});

describe("reply follow-up actions", () => {
  it("creates task for interest", () => {
    const action = getReplyFollowUpAction("interesse");
    expect(action.createTask).toBe(true);
    expect(action.shouldAutoReply).toBe(true);
  });

  it("suppresses on rejection", () => {
    const action = getReplyFollowUpAction("afgewezen");
    expect(action.addSuppression).toBe(true);
  });

  it("does not auto-reply on out of office", () => {
    const action = getReplyFollowUpAction("out_of_office");
    expect(action.shouldAutoReply).toBe(false);
    expect(action.createTask).toBe(true);
  });
});

describe("suggested reply generation", () => {
  it("suggests account manager reply for interest", async () => {
    const reply = await generateSuggestedReply("interesse", {
      ...baseContext,
      replyBody: "Graag een afspraak volgende week.",
    });

    expect(reply.shouldSend).toBe(true);
    expect(reply.bodyText?.toLowerCase()).toMatch(/kennismaking|gesprek|tijdslot/);
    expect(reply.bodyText?.toLowerCase()).not.toContain("ik wilde even");
  });

  it("does not suggest reply for out of office", async () => {
    const reply = await generateSuggestedReply("out_of_office", {
      ...baseContext,
      replyBody: "I am out of office until Monday.",
    });

    expect(reply.shouldSend).toBe(false);
    expect(reply.bodyText).toBeNull();
  });
});

describe("processIncomingReply", () => {
  it("returns full analysis without persisting", async () => {
    const result = await processIncomingReply(null, null, {
      subject: "Re: Kennismaking",
      body: "Graag bellen volgende week.",
      companyName: "ScaleUp BV",
      contactName: "Sanne",
      originalSubject: "Kennismaking — ScaleUp BV",
      persist: false,
    });

    expect(result.label).toBe("Interesse");
    expect(result.analysis.confidence).toBeGreaterThan(0);
    expect(result.suggestedReply.shouldSend).toBe(true);
  });
});
