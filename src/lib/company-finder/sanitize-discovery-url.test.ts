import { describe, expect, it } from "vitest";

import {
  discoveryUrlFallbackNote,
  sanitizeDiscoveryUrl,
} from "@/lib/company-finder/sanitize-discovery-url";

describe("sanitizeDiscoveryUrl", () => {
  it("accepts valid https URLs", () => {
    expect(sanitizeDiscoveryUrl("https://example.com/page")).toBe("https://example.com/page");
  });

  it("adds https when missing", () => {
    expect(sanitizeDiscoveryUrl("example.com")).toBe("https://example.com/");
  });

  it("rejects invalid URLs", () => {
    expect(sanitizeDiscoveryUrl("not a url")).toBeNull();
  });

  it("stores raw invalid URL in notes fallback", () => {
    expect(discoveryUrlFallbackNote("not a url")).toContain("niet gevalideerd");
  });
});
