"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, Save, Search, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type VacancyOption = {
  id: string;
  title: string;
  location: string | null;
};

type Proposal = {
  id: string;
  firstName: string;
  lastName: string;
  candidateCurrentRole: string | null;
  location: string | null;
  linkedinUrl: string;
  matchScore: number;
  matchRationale: string[];
  matchStrongPoints: string[];
  matchRisks: string[];
  matchMissingInfo: string[];
  sourceProvider: string | null;
  sourceQuery: string | null;
  createdAt: string;
};

type RunMeta = {
  id: string;
  status: string;
  queries: string[];
  searchAttempts?: Array<{ query: string; success: boolean; resultCount: number; providerId?: string }>;
};

export function CandidateSourcingClient() {
  const [vacancies, setVacancies] = useState<VacancyOption[]>([]);
  const [vacancyId, setVacancyId] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [additionalTitles, setAdditionalTitles] = useState("");
  const [location, setLocation] = useState("Rotterdam");
  const [skills, setSkills] = useState("");
  const [industry, setIndustry] = useState("");
  const [keywords, setKeywords] = useState("");
  const [instructions, setInstructions] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [run, setRun] = useState<RunMeta | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [draftByProposal, setDraftByProposal] = useState<Record<string, string>>({});

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/vacancies?status=open&limit=50");
      if (!res.ok) return;
      const payload = (await res.json()) as { vacancies?: Array<{ id: string; title: string; location: string | null }> };
      const rows = payload.vacancies ?? [];
      setVacancies(rows);
      if (rows[0]) setVacancyId(rows[0].id);
    })();
  }, []);

  const runSearch = useCallback(async () => {
    setLoading(true);
    setError(null);
    setProposals([]);
    setRun(null);
  setDraftByProposal({});

    try {
      const res = await fetch("/api/candidates/sourcing/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vacancyId,
          jobTitle: jobTitle || undefined,
          additionalJobTitles: additionalTitles
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          location: location || undefined,
          skills: skills
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          industry: industry || undefined,
          keywords: keywords
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          naturalLanguageInstructions: instructions || undefined,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error ?? "Zoeken mislukt");
        return;
      }
      setRun(payload.run);
      setProposals(payload.proposals ?? []);
    } catch {
      setError("Netwerkfout bij zoeken.");
    } finally {
      setLoading(false);
    }
  }, [vacancyId, jobTitle, additionalTitles, location, skills, industry, keywords, instructions]);

  const saveProposal = async (proposalId: string) => {
    const res = await fetch(`/api/candidates/sourcing/proposals/${proposalId}/save`, { method: "POST" });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "Opslaan mislukt");
      return;
    }
    setProposals((prev) =>
      prev.map((p) => (p.id === proposalId ? { ...p, matchRationale: [...p.matchRationale, "Opgeslagen in CRM."] } : p)),
    );
  };

  const loadDraft = async (proposalId: string) => {
    const res = await fetch(`/api/candidates/sourcing/proposals/${proposalId}/outreach-draft`, {
      method: "POST",
    });
    const payload = await res.json();
    if (!res.ok) {
      setError(payload.error ?? "Concept mislukt");
      return;
    }
    setDraftByProposal((prev) => ({
      ...prev,
      [proposalId]: `${payload.draft.subject}\n\n${payload.draft.bodyText}`,
    }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="size-5" />
            AI Candidate Sourcing (LinkedIn x-ray)
          </CardTitle>
          <CardDescription>
            Publiek geïndexeerde LinkedIn-profielen via geautoriseerde zoekproviders. Geen scraping, geen automatische
            verzending.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="vacancy">Vacature (CRM)</Label>
            <select
              id="vacancy"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={vacancyId}
              onChange={(e) => setVacancyId(e.target.value)}
            >
              {vacancies.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title}
                  {v.location ? ` — ${v.location}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Functietitel</Label>
            <Input id="jobTitle" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Corporate Recruiter" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="extraTitles">Extra titels (komma)</Label>
            <Input
              id="extraTitles"
              value={additionalTitles}
              onChange={(e) => setAdditionalTitles(e.target.value)}
              placeholder="Talent Acquisition Specialist"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Locatie</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="skills">Skills (komma)</Label>
            <Input id="skills" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="recruitment, ATS" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="industry">Sector</Label>
            <Input id="industry" value={industry} onChange={(e) => setIndustry(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords (komma)</Label>
            <Input id="keywords" value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="instructions">Natuurlijke taal</Label>
            <Textarea
              id="instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              placeholder="Bijv. focus op in-house recruiters in Rotterdam, minimaal 3 jaar ervaring"
              rows={3}
            />
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button type="button" onClick={() => void runSearch()} disabled={loading || !vacancyId}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              Zoek kandidaten
            </Button>
            <p className="text-xs text-muted-foreground">Max. 3 provider-zoekopdrachten per run (configureerbaar).</p>
          </div>
          {error ? <p className="text-sm text-destructive md:col-span-2">{error}</p> : null}
        </CardContent>
      </Card>

      {run ? (
        <Card>
          <CardHeader>
            <CardTitle>Run {run.id.slice(0, 8)}</CardTitle>
            <CardDescription>Status: {run.status}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-muted-foreground">
            {run.queries.map((q) => (
              <div key={q} className="font-mono">
                {q}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4">
        {proposals.map((p) => (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <div>
                <CardTitle>
                  {p.firstName} {p.lastName}
                </CardTitle>
                <CardDescription>{p.candidateCurrentRole ?? "Rol onbekend in SERP"}</CardDescription>
              </div>
              <Badge variant="secondary">Match {p.matchScore}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{p.location ?? "Locatie niet bevestigd in snippet"}</p>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                {p.matchRationale.slice(0, 6).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              {p.matchMissingInfo.length > 0 ? (
                <p className="text-xs text-muted-foreground">Ontbreekt: {p.matchMissingInfo.join(", ")}</p>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <a
                  href={p.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-medium hover:bg-muted"
                >
                  <ExternalLink className="size-4" />
                  LinkedIn
                </a>
                <Button variant="secondary" size="sm" onClick={() => void saveProposal(p.id)}>
                  <Save className="size-4" />
                  Opslaan + koppel vacature
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void loadDraft(p.id)}>
                  <Sparkles className="size-4" />
                  Outreach-concept
                </Button>
              </div>
              {draftByProposal[p.id] ? (
                <pre className="whitespace-pre-wrap rounded-md border bg-muted/40 p-3 text-xs">{draftByProposal[p.id]}</pre>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}