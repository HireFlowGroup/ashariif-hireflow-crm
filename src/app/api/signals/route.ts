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
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const client = await createClient();

  const { data, error } = await client
    .from("hiring_signals")
    .select("id, company_id, signal_type, title, description, importance, observed_at, companies(name)")
    .eq("organization_id", context.organizationId)
    .order("observed_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const signals = (data ?? []).map((row) => {
    const company = row.companies as { name?: string } | null;
    return {
      id: row.id as string,
      companyId: row.company_id as string,
      companyName: company?.name ?? "Onbekend",
      signalType: row.signal_type as string,
      title: (row.title as string | null) ?? null,
      description: (row.description as string | null) ?? null,
      importance: row.importance as number,
      observedAt: row.observed_at as string,
    };
  });

  return NextResponse.json({ signals });
}
