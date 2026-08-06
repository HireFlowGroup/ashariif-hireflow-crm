"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  X,
} from "lucide-react";

import { WorkspacePage } from "@/components/layout/workspace-page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { OutreachMessageStatus } from "@/features/outreach-engine/domain/types";

type OutreachMessageRow = {
  id: string;
  companyId: string;
  companyName?: string;
  recipientName: string | null;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: OutreachMessageStatus;
  personalizationData: {
    fieldsUsed?: string[];
    warnings?: string[];
    companyName?: string;
  };
  errorMessage: string | null;
  updatedAt: string;
};

type TabKey =
  | "draft"
  | "needs_review"
  | "pending_approval"
  | "approved"
  | "sent"
  | "failed"
  | "rejected"
  | "all";

const TAB_CONFIG: Array<{ key: TabKey; label: string; statuses?: OutreachMessageStatus[] }> = [
  { key: "draft", label: "Concepten", statuses: ["draft"] },
  { key: "needs_review", label: "Ter beoordeling", statuses: ["needs_review", "pending_approval"] },
  { key: "approved", label: "Goedgekeurd", statuses: ["approved"] },
  { key: "pending_approval", label: "Klaar voor verzending", statuses: ["queued"] },
  { key: "sent", label: "Verzonden", statuses: ["sent", "replied"] },
  { key: "failed", label: "Mislukt", statuses: ["failed", "bounced", "blocked_missing_recipient"] },
  { key: "rejected", label: "Afgewezen", statuses: ["rejected", "cancelled"] },
  { key: "all", label: "Alles" },
];

export function OutreachDashboard() {
  const [messages, setMessages] = useState<OutreachMessageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("needs_review");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailStatus, setEmailStatus] = useState<{
    connected: boolean;
    draftOnly: boolean;
    senderEmail: string | null;
  } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [msgRes, emailRes] = await Promise.all([
        fetch("/api/outreach/messages"),
        fetch("/api/outreach/email/verify"),
      ]);
      if (msgRes.ok) {
        const data = (await msgRes.json()) as { messages: OutreachMessageRow[] };
        setMessages(data.messages);
      }
      if (emailRes.ok) {
        const data = (await emailRes.json()) as {
          connected: boolean;
          draftOnly: boolean;
          senderEmail: string | null;
        };
        setEmailStatus(data);
      }
    } catch {
      setError("Outreach kon niet worden geladen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const tab = TAB_CONFIG.find((t) => t.key === activeTab);
    if (!tab?.statuses) return messages;
    return messages.filter((m) => tab.statuses!.includes(m.status));
  }, [messages, activeTab]);

  const selected = messages.find((m) => m.id === selectedId) ?? null;

  useEffect(() => {
    if (selected) {
      setEditSubject(selected.subject);
      setEditBody(selected.bodyText);
    }
  }, [selected]);

  async function runAction(path: string, body?: object) {
    if (!selected) return;
    setActionLoading(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Actie mislukt");
        return;
      }
      await load();
    } catch {
      setError("Actie mislukt");
    } finally {
      setActionLoading(false);
    }
  }

  const bulkCandidates = useMemo(
    () => filtered.filter((m) => ["draft", "pending_approval"].includes(m.status)),
    [filtered],
  );

  const bulkWarnings = useMemo(() => {
    const emails = bulkCandidates.filter((m) => selectedIds.has(m.id)).map((m) => m.recipientEmail);
    const duplicates = emails.filter((e, i) => emails.indexOf(e) !== i);
    return {
      count: selectedIds.size,
      duplicates: [...new Set(duplicates)],
      unverified: emails.filter((e) => e.includes("@local.invalid")),
    };
  }, [bulkCandidates, selectedIds]);

  async function bulkApprove() {
    if (selectedIds.size === 0) return;
    const summary = [
      `${selectedIds.size} bericht(en)`,
      emailStatus?.senderEmail ? `Afzender: ${emailStatus.senderEmail}` : "Geen afzender geconfigureerd",
      `Daglimiet: ${emailStatus ? "10" : "?"}`,
      bulkWarnings.duplicates.length ? `Duplicaten: ${bulkWarnings.duplicates.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    if (!window.confirm(`Bulk goedkeuren?\n\n${summary}`)) return;

    setBulkLoading(true);
    setError(null);
    try {
      for (const id of selectedIds) {
        await fetch(`/api/outreach/messages/${id}/approve`, { method: "POST" });
      }
      setSelectedIds(new Set());
      await load();
    } catch {
      setError("Bulk goedkeuring mislukt.");
    } finally {
      setBulkLoading(false);
    }
  }

  function toggleBulkSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tab of TAB_CONFIG) {
      if (!tab.statuses) {
        map[tab.key] = messages.length;
      } else {
        map[tab.key] = messages.filter((m) => tab.statuses!.includes(m.status)).length;
      }
    }
    return map;
  }, [messages]);

  return (
    <WorkspacePage
      title="Outreach"
      description="Veilige e-mailflow — standaard DRAFT_ONLY, expliciete goedkeuring vereist."
      actions={
        <div className="flex items-center gap-2">
          {emailStatus ? (
            <Badge variant={emailStatus.connected ? "default" : "outline"}>
              {emailStatus.draftOnly ? "DRAFT_ONLY" : "LIVE"} · {emailStatus.senderEmail ?? "geen afzender"}
            </Badge>
          ) : null}
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="size-4" />
            Vernieuwen
          </Button>
          <Link
            href="/companies"
            className="inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            Naar bedrijven
          </Link>
        </div>
      }
    >
      {error ? (
        <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {TAB_CONFIG.map((tab) => (
          <Button
            key={tab.key}
            type="button"
            size="sm"
            variant={activeTab === tab.key ? "default" : "outline"}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
            <span className="ml-1.5 text-xs opacity-70">({counts[tab.key] ?? 0})</span>
          </Button>
        ))}
      </div>

      {bulkCandidates.length > 0 && ["draft", "pending_approval"].includes(activeTab) ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-4 py-3 text-sm">
          <span className="font-medium">Bulk review</span>
          <span className="text-muted-foreground">{selectedIds.size} geselecteerd</span>
          {bulkWarnings.duplicates.length > 0 ? (
            <span className="text-amber-700">Duplicaten: {bulkWarnings.duplicates.join(", ")}</span>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={bulkLoading || selectedIds.size === 0}
            onClick={() => void bulkApprove()}
          >
            {bulkLoading ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Goedkeuren ({selectedIds.size})
          </Button>
        </div>
      ) : null}

      {loading ? (
        <div className="flex items-center justify-center py-24 text-sm text-muted-foreground">
          <Loader2 className="mr-2 size-4 animate-spin" />
          Outreach laden…
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          <div className="lg:col-span-2 divide-y rounded-xl border max-h-[70vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                Geen berichten in deze categorie.
              </div>
            ) : (
              filtered.map((row) => (
                <div
                  key={row.id}
                  className={`flex items-start gap-2 px-4 py-3 transition-colors hover:bg-muted/30 ${selectedId === row.id ? "bg-muted/50" : ""}`}
                >
                  {["draft", "pending_approval"].includes(row.status) ? (
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={selectedIds.has(row.id)}
                      onChange={() => toggleBulkSelect(row.id)}
                      aria-label={`Selecteer ${row.companyName ?? row.recipientEmail}`}
                    />
                  ) : (
                    <span className="w-4" />
                  )}
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedId(row.id)}
                  >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{row.companyName ?? row.personalizationData.companyName ?? "Bedrijf"}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{row.status}</Badge>
                  </div>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{row.recipientEmail}</p>
                  <p className="mt-1 truncate text-sm">{row.subject}</p>
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="lg:col-span-3">
            {selected ? (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Draft review</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 text-sm">
                    <p><span className="text-muted-foreground">Bedrijf:</span>{" "}
                      <Link href={`/companies/${selected.companyId}`} className="underline">{selected.companyName ?? "—"}</Link>
                    </p>
                    <p><span className="text-muted-foreground">Ontvanger:</span> {selected.recipientName ?? "—"} &lt;{selected.recipientEmail}&gt;</p>
                  </div>

                  {(selected.personalizationData.warnings?.length ?? 0) > 0 ? (
                    <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
                      <ShieldAlert className="mt-0.5 size-4 shrink-0" />
                      <div>
                        {selected.personalizationData.warnings?.map((w) => (
                          <p key={w}>{w}</p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Onderwerp</label>
                    <input
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={editSubject}
                      onChange={(e) => setEditSubject(e.target.value)}
                      disabled={selected.status === "sent"}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">E-mailtekst</label>
                    <textarea
                      className="min-h-[200px] w-full rounded-md border bg-background px-3 py-2 text-sm font-mono"
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      disabled={selected.status === "sent"}
                    />
                  </div>

                  {selected.personalizationData.fieldsUsed?.length ? (
                    <p className="text-xs text-muted-foreground">
                      Personalisatie: {selected.personalizationData.fieldsUsed.join(", ")}
                    </p>
                  ) : null}

                  {selected.status !== "sent" ? (
                    <div className="flex flex-wrap gap-2 pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() =>
                          void fetch(`/api/outreach/messages/${selected.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ subject: editSubject, bodyText: editBody }),
                          }).then(() => load())
                        }
                      >
                        Bewerken
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionLoading || !["draft", "pending_approval"].includes(selected.status)}
                        onClick={() => void runAction(`/api/outreach/messages/${selected.id}/approve`)}
                      >
                        <Check className="size-4" />
                        Goedkeuren
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={actionLoading}
                        onClick={() => void runAction(`/api/outreach/messages/${selected.id}/reject`)}
                      >
                        <X className="size-4" />
                        Afwijzen
                      </Button>
                    </div>
                  ) : null}

                  {selected.status !== "sent" ? (
                    <div className="rounded-md border bg-muted/20 p-3 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Mail className="size-4" />
                        Testmail (alleen naar eigen adres)
                      </p>
                      <input
                        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                        placeholder="jouw@bedrijf.nl"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={actionLoading || !testEmail}
                        onClick={() =>
                          void runAction(`/api/outreach/messages/${selected.id}/send`, {
                            confirmed: true,
                            testRecipientEmail: testEmail,
                          })
                        }
                      >
                        Testmail versturen
                      </Button>
                    </div>
                  ) : null}

                  {["approved", "pending_approval", "draft"].includes(selected.status) ? (
                    <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3 space-y-2">
                      <p className="text-sm font-medium flex items-center gap-2 text-destructive">
                        <Send className="size-4" />
                        Verzenden (expliciete bevestiging vereist)
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={actionLoading || selected.status !== "approved"}
                        onClick={() => {
                          if (!window.confirm(`Weet je zeker dat je wilt verzenden naar ${selected.recipientEmail}?`)) return;
                          void runAction(`/api/outreach/messages/${selected.id}/send`, { confirmed: true });
                        }}
                      >
                        Verzenden na goedkeuring
                      </Button>
                      {selected.status !== "approved" ? (
                        <p className="text-xs text-muted-foreground">Goedkeur eerst voordat je verzendt.</p>
                      ) : null}
                    </div>
                  ) : null}

                  {selected.errorMessage ? (
                    <p className="text-sm text-destructive">{selected.errorMessage}</p>
                  ) : null}
                </CardContent>
              </Card>
            ) : (
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
                Selecteer een bericht om te reviewen.
              </div>
            )}
          </div>
        </div>
      )}
    </WorkspacePage>
  );
}
