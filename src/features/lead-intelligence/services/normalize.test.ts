import { describe, expect, it } from "vitest";
import {
  extractDomain,
  normalizeCompanyName,
  normalizeWebsite,
} from "@/features/lead-intelligence/services/normalize";

describe("normalize", () => {
  it("normalizes legal suffixes from company names", () => {
    expect(normalizeCompanyName("Acme Software B.V.")).toBe("acme software");
    expect(normalizeCompanyName("Test Holding N.V.")).toBe("test");
  });

  it("normalizes websites to canonical https domain", () => {
    expect(normalizeWebsite("http://www.example.com/path/")).toBe("https://example.com");
    expect(normalizeWebsite("example.nl")).toBe("https://example.nl");
  });

  it("extracts domain from url", () => {
    expect(extractDomain("https://www.hireflow.nl/about")).toBe("hireflow.nl");
  });
});
