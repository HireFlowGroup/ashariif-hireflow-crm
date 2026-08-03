"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Megaphone } from "lucide-react";

import { WorkspacePage } from "@/components/layout/workspace-page";
import { Badge } from "@/components/ui/badge";
import { priorityColorClass } from "@/features/priority-engine";

type OutreachRow = {
  id: string;
  companyId: string;
  companyName: string;
  status: string;
  priority: string | null;
  score: number | null;
  outreachScore: number | null;
  recommendedChannel: string | null;
  updatedAt: string;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m geleden`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u geleden`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export default function OutreachPage() {
  const [rows, setRows] = useState<OutreachRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const response = await fetch("/api/outreach/queue?limit=40");
        if (response.ok) {
          setRows(((await response.json()) as { items: OutreachRow[] }).items);
        }
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  return (
    <WorkspacePage
      title="Outreach"
      description="Outreach queue en AI-gegenereerde drafts — geen traditionele CRM pipeline."
      actions={
        <Link
          href="/companies"
          className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          Naar companies
        </Link>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Outreach laden…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed px-6 py-16 text-center">
          <Megaphone className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Geen outreach in queue</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Genereer outreach via een bedrijfspagina of queue vanuit Companies.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-xl border">
          {rows.map((row) => (
            <Link
              key={row.id}
              href={`/companies/${row.companyId}`}
              className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{row.companyName}</p>
                  {row.priority ? (
                    <span className={`text-xs font-semibold ${priorityColorClass(row.priority as never)}`}>
                      {row.priority}
                    </span>
                  ) : null}
                  <Badge variant="outline">{row.status}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {row.recommendedChannel ?? "—"} · {formatRelative(row.updatedAt)}
                </p>
              </div>
              <div className="text-right text-sm tabular-nums">
                <p className="font-medium">{row.outreachScore ?? row.score ?? "—"}</p>
                <p className="text-[10px] text-muted-foreground">score</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </WorkspacePage>
  );
}
