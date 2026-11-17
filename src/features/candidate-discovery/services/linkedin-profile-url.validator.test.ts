import { describe, expect, it } from "vitest";

import {
  isLinkedInProfileUrl,
  normalizeLinkedInProfileUrl,
} from "@/features/candidate-discovery/services/linkedin-profile-url.validator";

describe("normalizeLinkedInProfileUrl", () => {
  it("accepts valid /in/ urls and strips query params", () => {
    const result = normalizeLinkedInProfileUrl(
      "https://www.linkedin.com/in/lisa-jansen-dev?trk=foo",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.normalizedUrl).toBe("https://www.linkedin.com/in/lisa-jansen-dev");
      expect(result.value.profileSlug).toBe("lisa-jansen-dev");
    }
  });

  it("rejects company and jobs urls", () => {
    expect(normalizeLinkedInProfileUrl("https://linkedin.com/company/acme").ok).toBe(false);
    expect(normalizeLinkedInProfileUrl("https://linkedin.com/jobs/view/1").ok).toBe(false);
  });

  it("isLinkedInProfileUrl mirrors validation", () => {
    expect(isLinkedInProfileUrl("https://linkedin.com/in/slug")).toBe(true);
    expect(isLinkedInProfileUrl("https://linkedin.com/in/")).toBe(false);
  });
});