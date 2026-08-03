import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  getActiveSearchProviders,
  getSearchProviderAvailability,
} from "@/features/lead-intelligence/providers/manager/search-provider-availability";
import { setOrgProviderCredentials } from "@/features/provider-vault/server/credential-cache.service";
import { runWithOrganizationId } from "@/features/provider-vault/server/org-context";

describe("search-provider-availability", () => {
  const originalTavilyKey = process.env.TAVILY_API_KEY;

  beforeEach(() => {
    process.env.TAVILY_API_KEY = "tvly-test-key";
  });

  afterEach(() => {
    process.env.TAVILY_API_KEY = originalTavilyKey;
  });

  it("activates Tavily from env when no org vault entry exists", () => {
    const availability = getSearchProviderAvailability("test.env-only");
    const tavily = availability.find((entry) => entry.providerId === "tavily");

    expect(tavily).toMatchObject({
      configured: true,
      enabled: true,
      active: true,
      secretSource: "env",
      healthStatus: "healthy",
    });
    expect(getActiveSearchProviders("test.env-only").map((entry) => entry.providerId)).toContain("tavily");
  });

  it("respects org-level disable in vault and skips env fallback", () => {
    runWithOrganizationId("org-disabled", () => {
      setOrgProviderCredentials("org-disabled", "tavily", {
        enabled: false,
        secrets: {},
        fingerprint: "disabled",
        maskedPreview: null,
      });

      const tavily = getSearchProviderAvailability("test.org-disabled").find(
        (entry) => entry.providerId === "tavily",
      );

      expect(tavily).toMatchObject({
        configured: false,
        enabled: false,
        active: false,
        secretSource: "none",
      });
    });
  });
});
