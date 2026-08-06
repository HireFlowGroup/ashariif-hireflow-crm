"use client";

import { useMemo, useState } from "react";

import { OutreachConceptPanel } from "@/components/ai-recruiter/outreach-concept-panel";
import { ProspectDossierPanel } from "@/components/ai-recruiter/prospect-dossier-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDecisionLabel } from "@/features/ai-recruiter/services/prospect-decision.service";
import type { AiRecruiterRun, AiRecruiterRunItem } from "@/features/ai-recruiter/domain/types";
import { cn } from "@/lib/utils";

export type ReviewFilter =
  | "all"
  | "priority_a"
  | "priority_b"
  | "general_mailbox"
  | "personal_contact"
  | "with_vacancy"
  | "without_vacancy"
  | "ready_for_approval"
  | "blocked";

type Props = {
  run: AiRecruiterRun;
  items: AiRecruiterRunItem[];
  selectedItemId: string | null;
  onSelectItem: (id: string) => void;
  onItemUpdated: (item: AiRecruiterRunItem) => void;
  onError: (message: string) => void;
};

const FILTERS: Array<{ key: ReviewFilter; label: string }> = [
  { key: "all", label: "Alles" },
  { key: "priority_a", label: "Prioriteit A" },
  { key: "priority_b", label: "Prioriteit B" },
  { key: "general_mailbox", label: "Algemene mailbox" },
  { key: "personal_contact", label: "Persoonlijk contact" },
  { key: "with_vacancy", label: "Met vacature" },
  { key: "without_vacancy", label: "Zonder vacature" },
  { key: "ready_for_approval", label: "Klaar voor goedkeuring" },
  { key: "blocked", label: "Geblokkeerd" },
];

function matchesFilter(item: AiRecruiterRunItem, filter: ReviewFilter): boolean {
  const priority = item.scoreBreakdown?.priority;
  const external = item.externalCompanyData as {
    contactDiscovery?: { selected?: { isGeneralMailbox?: boolean; email?: string } };
    vacancyEvidence?: unknown[];
    eligibility?: { eligible?: boolean };
  } | null;

  const isGeneral = external?.contactDiscovery?.selected?.isGeneralMailbox ?? item.stage === "general_mailbox_found";
  const hasVacancy = (external?.vacancyEvidence?.length ?? 0) > 0 || (item.hiringScore ?? 0) > 0;
  const hasDraft = Boolean(item.outreachMessageId);
  const blocked = item.status === "skipped" || item.status === "failed";

  switch (filter) {
    case "priority_a":
      return priority === "A";
    case "priority_b":
      return priority === "B";
    case "general_mailbox":
      return isGeneral;
    case "personal_contact":
      return !isGeneral && Boolean(external?.contactDiscovery?.selected?.email);
    case "with_vacancy":
      return hasVacancy;
    case "without_vacancy":
      return !hasVacancy;
    case "ready_for_approval":
      return hasDraft && item.status === "completed";
    case "blocked":
      return blocked;
    default:
      return true;
  }
}

export function ProspectReviewWorkspace({
  run,
  items,
  selectedItemId,
  onSelectItem,
  onItemUpdated,
  onError,
}: Props) {
  const [filter, setFilter] = useState<ReviewFilter>("all");

  const filteredItems = useMemo(
    () => items.filter((item) => matchesFilter(item, filter)),
    [items, filter],
  );

  const selectedItem = filteredItems.find((i) => i.id === selectedItemId)
    ?? filteredItems[0]
    ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
      <div className="flex flex-col rounded-xl border xl:max-h-[calc(100vh-10rem)] xl:overflow-hidden">
        <div className="border-b bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium">Review queue ({filteredItems.length})</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <Button
                key={f.key}
                size="sm"
                variant={filter === f.key ? "secondary" : "ghost"}
                className="h-7 px-2 text-[10px]"
                onClick={() => setFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex-1 divide-y overflow-y-auto">
          {filteredItems.length === 0 ? (
            <p className="px-3 py-8 text-sm text-muted-foreground">Geen prospects in deze filter.</p>
          ) : (
            filteredItems.map((item) => {
              const external = item.externalCompanyData as {
                vacancyEvidence?: Array<{ title?: string }>;
                contactDiscovery?: { selected?: { isGeneralMailbox?: boolean } };
              } | null;
              const vacancyTitle = external?.vacancyEvidence?.[0]?.title ?? "—";
              const isGeneral = external?.contactDiscovery?.selected?.isGeneralMailbox;

              return (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    "w-full px-3 py-3 text-left hover:bg-muted/30",
                    selectedItem?.id === item.id && "bg-muted/50 ring-1 ring-inset ring-primary/20",
                  )}
                  onClick={() => onSelectItem(item.id)}
                >
                  <p className="font-medium text-sm">{item.companyName ?? "Bedrijf"}</p>
                  <p className="text-xs text-muted-foreground truncate">{vacancyTitle}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      {item.totalScore ?? "—"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {formatDecisionLabel(item.scoreBreakdown?.decision)}
                    </Badge>
                    {isGeneral ? (
                      <Badge variant="secondary" className="text-[10px]">Mailbox</Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">Persoonlijk</Badge>
                    )}
                    {item.outreachMessageId ? (
                      <Badge className="text-[10px]">Concept</Badge>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="min-w-0 rounded-xl border p-4 xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto">
        {selectedItem ? (
          <ProspectDossierPanel
            runId={run.id}
            item={selectedItem}
            onItemUpdated={onItemUpdated}
            onError={onError}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Selecteer een prospect om het dossier te bekijken.</p>
        )}
      </div>

      <div className="xl:max-h-[calc(100vh-10rem)] xl:overflow-y-auto">
        {selectedItem ? (
          <OutreachConceptPanel
            runId={run.id}
            item={selectedItem}
            onItemUpdated={onItemUpdated}
            onError={onError}
          />
        ) : (
          <div className="rounded-xl border p-4 text-sm text-muted-foreground">
            Selecteer een prospect voor conceptmail.
          </div>
        )}
      </div>
    </div>
  );
}
