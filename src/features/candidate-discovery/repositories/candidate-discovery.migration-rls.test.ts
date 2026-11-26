import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationPath = join(
  process.cwd(),
  "supabase/migrations/20251117130000_candidate_discovery.sql",
);

describe("candidate_discovery migration RLS", () => {
  const sql = readFileSync(migrationPath, "utf8");

  it("enables RLS and tenant isolation policies on runs and proposals", () => {
    expect(sql).toContain("alter table public.candidate_discovery_runs enable row level security");
    expect(sql).toContain("alter table public.candidate_discovery_proposals enable row level security");
    expect(sql).toContain("tenant_isolation_candidate_discovery_runs");
    expect(sql).toContain("tenant_isolation_candidate_discovery_proposals");
    expect(sql).toContain("organization_id = public.current_organization_id()");
  });

  it("enforces unique proposal per org vacancy linkedin url", () => {
    expect(sql).toContain("candidate_discovery_proposals_org_vacancy_linkedin_uniq");
    expect(sql).toContain("unique (organization_id, vacancy_id, linkedin_url)");
  });

  it("defaults proposals to proposed without required saved_candidate_id", () => {
    expect(sql).toContain("approval_status text not null default 'proposed'");
    expect(sql).not.toContain("insert into public.candidates");
  });

  it("links runs to vacancies and organizations", () => {
    expect(sql).toMatch(/vacancy_id uuid not null references public\.vacancies/);
    expect(sql).toMatch(/organization_id uuid not null references public\.organizations/);
  });
});