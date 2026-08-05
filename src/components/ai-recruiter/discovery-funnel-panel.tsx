"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type DiscoveryFunnelSummary = {
  queriesExecuted: number;
  rawResults: number;
  uniqueUrls: number;
  realCompanies: number;
  withVacancyEvidence: number;
  competitorsExcluded: number;
  directoriesAndArticles: number;
  saved: number;
  rejected: number;
};

export type DiscoveryResultRow = {
  resultTitle: string;
  resultUrl: string;
  classifiedType: string;
  extractedEmployer: string | null;
  officialDomain: string | null;
  vacancyTitle: string | null;
  accepted: boolean;
  rejectionReason: string | null;
  classificationConfidence: number;
  classificationReason: string;
};

type DiscoveryFunnelPanelProps = {
  funnel: DiscoveryFunnelSummary | null;
  results: DiscoveryResultRow[];
  providerId?: string | null;
};

export function DiscoveryFunnelPanel({ funnel, results, providerId }: DiscoveryFunnelPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (!funnel) return null;

  const directoriesAndArticles =
    funnel.directoriesAndArticles
    ?? (funnel as { directories?: number; listArticles?: number }).directories ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Search className="size-4" />
          Discovery
        </CardTitle>
        <CardDescription>
          {providerId ? `Provider: ${providerId}` : "Zoekresultaten en classificatie"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
          <Metric label="Zoekqueries uitgevoerd" value={funnel.queriesExecuted} />
          <Metric label="Resultaten ontvangen" value={funnel.rawResults} />
          <Metric label="Echte bedrijven geïdentificeerd" value={funnel.realCompanies} />
          <Metric label="Met vacature-evidence" value={funnel.withVacancyEvidence} />
          <Metric label="Concurrenten uitgesloten" value={funnel.competitorsExcluded} />
          <Metric label="Directories/artikelen afgewezen" value={directoriesAndArticles} />
          <Metric label="Opgeslagen" value={funnel.saved} />
          <Metric label="Afgewezen" value={funnel.rejected} />
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="mr-2 size-4" /> : <ChevronDown className="mr-2 size-4" />}
          Bekijk discovery-resultaten
        </Button>

        {expanded ? (
          <div className="overflow-x-auto rounded-lg border max-h-[480px] overflow-y-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="sticky top-0 bg-muted/80 text-left">
                <tr>
                  <th className="px-3 py-2">Titel</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Werkgever</th>
                  <th className="px-3 py-2">Domein</th>
                  <th className="px-3 py-2">Vacature</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Reden</th>
                </tr>
              </thead>
              <tbody>
                {results.map((row) => (
                  <tr key={`${row.resultUrl}-${row.resultTitle}`} className="border-t align-top">
                    <td className="px-3 py-2">
                      <a
                        href={row.resultUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary hover:underline"
                      >
                        {row.resultTitle}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="outline">{row.classifiedType}</Badge>
                    </td>
                    <td className="px-3 py-2">{row.extractedEmployer ?? "—"}</td>
                    <td className="px-3 py-2">{row.officialDomain ?? "—"}</td>
                    <td className="px-3 py-2">{row.vacancyTitle ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={row.accepted ? "default" : "secondary"}>
                        {row.accepted ? "Geaccepteerd" : "Afgewezen"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.rejectionReason ?? row.classificationReason}
                      {" "}
                      ({Math.round(row.classificationConfidence * 100)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-semibold text-lg">{value}</p>
    </div>
  );
}

export function buildFunnelSummary(
  funnel: {
    queriesExecuted: number;
    rawResults: number;
    uniqueUrls: number;
    realCompanies: number;
    withVacancyEvidence: number;
    competitorsExcluded: number;
    directories: number;
    listArticles: number;
    newsArticles: number;
    saved: number;
    rejected: number;
  },
): DiscoveryFunnelSummary {
  return {
    queriesExecuted: funnel.queriesExecuted,
    rawResults: funnel.rawResults,
    uniqueUrls: funnel.uniqueUrls,
    realCompanies: funnel.realCompanies,
    withVacancyEvidence: funnel.withVacancyEvidence,
    competitorsExcluded: funnel.competitorsExcluded,
    directoriesAndArticles: funnel.directories + funnel.listArticles + funnel.newsArticles,
    saved: funnel.saved,
    rejected: funnel.rejected,
  };
}
