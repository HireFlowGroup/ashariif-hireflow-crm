import { NextResponse } from "next/server";

import { getAuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const context = await getAuthenticatedServiceContext();

  if (!context) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "8", 10), 20);

  if (query.length < 2) {
    return NextResponse.json({ companies: [], vacancies: [] });
  }

  const client = await createClient();
  const pattern = `%${query}%`;

  const [companiesResult, vacanciesResult] = await Promise.all([
    client
      .from("companies")
      .select("id, name, city, priority, lead_score")
      .eq("organization_id", context.organizationId)
      .or(`name.ilike.${pattern},city.ilike.${pattern},sector.ilike.${pattern}`)
      .order("lead_score", { ascending: false, nullsFirst: false })
      .limit(limit),
    client
      .from("vacancies")
      .select("id, title, status, companies(name)")
      .eq("organization_id", context.organizationId)
      .ilike("title", pattern)
      .neq("status", "closed")
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const companies = (companiesResult.data ?? []).map((row) => ({
    id: row.id as string,
    name: row.name as string,
    city: (row.city as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    score: (row.lead_score as number | null) ?? null,
  }));

  const vacancies = (vacanciesResult.data ?? []).map((row) => {
    const company = row.companies as { name?: string } | null;
    return {
      id: row.id as string,
      title: row.title as string,
      companyName: company?.name ?? null,
      status: row.status as string,
    };
  });

  return NextResponse.json({ companies, vacancies });
}
