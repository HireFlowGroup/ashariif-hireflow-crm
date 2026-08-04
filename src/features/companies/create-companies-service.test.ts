import { describe, expect, it } from "vitest";

import { mapDiscoveryCreateInputToRow } from "@/features/companies/repositories/company.mapper";
import { createCompaniesWriteClient } from "@/features/companies/create-companies-service";

const ORG_ID = "11111111-1111-4111-8111-111111111111";

describe("mapDiscoveryCreateInputToRow", () => {
  it("always sets organization_id for tenant-scoped inserts", () => {
    const row = mapDiscoveryCreateInputToRow(ORG_ID, {
      name: "Acme BV",
      website: "https://acme.nl",
      sector: "IT",
      source: "tavily",
      sourceUrl: "https://acme.nl",
      confidence: 0.8,
      companyType: "company_website",
      companyConfidence: 100,
      discoveryReason: "validated",
      discoveryProvider: "tavily",
      status: "prospect",
      ownerId: "22222222-2222-4222-8222-222222222222",
    });

    expect(row.organization_id).toBe(ORG_ID);
    expect(row.name).toBe("Acme BV");
    expect(row.company_type).toBe("company_website");
    expect(row.company_confidence).toBe(100);
  });
});

describe("createCompaniesWriteClient", () => {
  it("returns a Supabase client instance", () => {
    const authClient = { auth: {}, from: () => ({}) } as never;
    const client = createCompaniesWriteClient(authClient);
    expect(client).toBeTruthy();
    expect(typeof client.from).toBe("function");
  });
});
