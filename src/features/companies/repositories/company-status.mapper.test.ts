import { describe, expect, it } from "vitest";

import {
  toDbCompanyStatus,
  toDomainCompanyStatus,
} from "@/features/companies/repositories/company-status.mapper";

describe("company-status.mapper", () => {
  it("maps prospect to legacy Nieuw for inserts", () => {
    expect(toDbCompanyStatus("prospect")).toBe("Nieuw");
  });

  it("maps active to Klant", () => {
    expect(toDbCompanyStatus("active")).toBe("Klant");
  });

  it("reads Nieuw as prospect in the domain", () => {
    expect(toDomainCompanyStatus("Nieuw")).toBe("prospect");
  });

  it("reads Klant as active in the domain", () => {
    expect(toDomainCompanyStatus("Klant")).toBe("active");
  });
});
