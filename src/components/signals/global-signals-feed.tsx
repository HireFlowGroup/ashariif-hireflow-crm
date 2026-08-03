"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Radar } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { getSignalTypeLabel } from "@/features/hiring-intelligence/domain/signal-types";
import { cn } from "@/lib/utils";

type SignalRow = {
  id: string;
  companyId: string;
  companyName: string;
  signalType: string;
  title: string | null;
  description: string | null;
  importance: number;
  observedAt: string;
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "zojuist";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}u`;
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function GlobalSignalsFeed() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/signals?limit=50");
        if (!response.ok) return;
        const body = (await response.json()) as { signals: SignalRow[] };
        if (!cancelled) setSignals(body.signals);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
        <Loader2 className="mr-2 size-4 animate-spin" />
        Signals laden…
      </div>
    );
  }

  if (signals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <Radar className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium">Nog geen hiring signals</p>
        <p className="mt-1 text-sm text-muted-foreground">Run Company Finder of wacht op Daily Intelligence.</p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-xl border bg-card">
      {signals.map((signal) => (
        <Link
          key={signal.id}
          href={`/companies/${signal.companyId}`}
          className="flex items-start gap-4 px-4 py-3 transition-colors hover:bg-muted/30"
        >
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
            <Radar className="size-3.5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{signal.companyName}</p>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {getSignalTypeLabel(signal.signalType as never)}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{formatRelative(signal.observedAt)}</span>
            </div>
            <p className="mt-0.5 text-sm text-foreground/90">{signal.title ?? "—"}</p>
            {signal.description ? (
              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{signal.description}</p>
            ) : null}
          </div>
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 tabular-nums",
              signal.importance >= 80 && "border-emerald-500/30 text-emerald-600",
            )}
          >
            {signal.importance}
          </Badge>
        </Link>
      ))}
    </div>
  );
}
