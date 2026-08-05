"use client";

import Link from "next/link";
import { ArrowRight, Workflow } from "lucide-react";

import { CommercialPipelineCountsStrip } from "@/components/commercial-pipeline/commercial-pipeline-board";
import { DashboardBarChart } from "@/components/dashboard/charts/dashboard-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import type { CommercialPipelineBoard } from "@/features/commercial-pipeline/domain/types";

export function CommercialPipelineDashboardWidget({ board }: { board: CommercialPipelineBoard }) {
  const chartData = board.columns
    .filter((column) => column.stage !== "verloren")
    .map((column) => ({
      label: column.label,
      value: column.count,
    }));

  const activeDeals = board.totalCards - board.stageCounts.verloren;

  return (
    <Card className="col-span-full">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="inline-flex items-center gap-2">
            <Workflow className="size-5" />
            Commerciële BD Pipeline
          </CardTitle>
          <CardDescription>
            AI Business Development — van prospect tot plaatsing ({activeDeals} actief)
          </CardDescription>
        </div>
        <Link href="/pipeline" className={buttonVariants({ variant: "outline", size: "sm" })}>
          Open Kanban
          <ArrowRight className="ml-2 size-4" />
        </Link>
      </CardHeader>
      <CardContent className="space-y-6">
        {board.totalCards === 0 ? (
          <div className="rounded-lg border border-dashed px-4 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              Nog geen deals in de commerciële pipeline.
            </p>
            <Link href="/pipeline" className={buttonVariants({ variant: "link", className: "mt-2" })}>
              Pipeline opstarten
            </Link>
          </div>
        ) : (
          <>
            <CommercialPipelineCountsStrip board={board} />
            {chartData.some((item) => item.value > 0) ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">Deals per fase</p>
                <DashboardBarChart data={chartData} layout="horizontal" height={280} />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
