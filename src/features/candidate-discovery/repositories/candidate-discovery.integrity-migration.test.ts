import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const integrityPath = join(
  process.cwd(),
  "supabase/migrations/20251117130100_candidate_discovery_integrity.sql",
);

const basePath = join(
  process.cwd(),
  "supabase/migrations/20251117130000_candidate_discovery.sql",
);

describe("candidate discovery integrity migration (F1/F2)", () => {
  const sql = readFileSync(integrityPath, "utf8");
  const baseSql = readFileSync(basePath, "utf8");

  it("defines run validator trigger without dropping tables", () => {
    expect(sql).toContain("candidate_discovery_validate_run");
    expect(sql).toContain("candidate_discovery_runs_validate_tenant");
    expect(sql).toContain("candidate_discovery_vacancy_org_mismatch");
    expect(sql.toLowerCase()).not.toContain("drop table");
    expect(sql.toLowerCase()).not.toContain("delete from");
  });

  it("defines proposal validator aligned with run org and vacancy", () => {
    expect(sql).toContain("candidate_discovery_validate_proposal");
    expect(sql).toContain("candidate_discovery_proposal_vacancy_mismatch");
    expect(sql).toContain("candidate_discovery_proposal_org_mismatch");
  });

  it("uses idempotent trigger recreation", () => {
    expect(sql).toContain("drop trigger if exists");
    expect(sql).toContain("create or replace function");
  });

  it("leaves base RLS policies unchanged", () => {
    expect(baseSql).toContain("tenant_isolation_candidate_discovery_runs");
    expect(sql).not.toContain("drop policy");
  });
});