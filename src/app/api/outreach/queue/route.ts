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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "40", 10), 100);

  const client = await createClient();

  const { data, error } = await client
    .from("outreach_intelligence")
    .select(
      "id, company_id, outreach_score, recommended_channel, computed_at, companies(name, priority, lead_score, outreach_status)",
    )
    .eq("organization_id", context.organizationId)
    .eq("is_current", true)
    .order("outreach_score", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const items = (data ?? []).map((row) => {
    const company = row.companies as {
      name?: string;
      priority?: string | null;
      lead_score?: number | null;
      outreach_status?: string | null;
    } | null;

    return {
      id: row.id as string,
      companyId: row.company_id as string,
      companyName: company?.name ?? "Onbekend",
      status: company?.outreach_status ?? "ready",
      priority: company?.priority ?? null,
      score: company?.lead_score ?? null,
      outreachScore: row.outreach_score as number,
      recommendedChannel: row.recommended_channel as string,
      updatedAt: row.computed_at as string,
    };
  });

  return NextResponse.json({ items });
}
