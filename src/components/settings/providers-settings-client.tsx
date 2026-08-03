"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Database,
  Loader2,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { ProviderSettingsSnapshot } from "@/features/provider-vault/client";

type TestResult = {
  providerId: string;
  success: boolean;
  durationMs: number;
  message: string;
};

const CATEGORY_LABELS: Record<ProviderSettingsSnapshot["category"], string> = {
  search: "Zoeken",
  crawler: "Crawlers",
  ai: "AI",
};

function statusVariant(status: ProviderSettingsSnapshot["status"]) {
  switch (status) {
    case "healthy":
      return "default" as const;
    case "degraded":
      return "secondary" as const;
    case "unhealthy":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function sourceLabel(source: ProviderSettingsSnapshot["secretSource"]) {
  switch (source) {
    case "vault":
      return "Vault";
    case "env":
      return "Env fallback";
    default:
      return "Niet geconfigureerd";
  }
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function ProviderManagementCard({
  provider,
  secretDraft,
  onSecretChange,
  onSave,
  onClear,
  onTest,
  onResetCache,
  onRefreshHealth,
  isSaving,
  isTesting,
  isRefreshing,
  testResult,
}: {
  provider: ProviderSettingsSnapshot;
  secretDraft: Record<string, string>;
  onSecretChange: (field: string, value: string) => void;
  onSave: () => void;
  onClear: () => void;
  onTest: () => void;
  onResetCache: () => void;
  onRefreshHealth: () => void;
  isSaving: boolean;
  isTesting: boolean;
  isRefreshing: boolean;
  testResult?: TestResult;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{provider.name}</CardTitle>
            <CardDescription>{provider.description}</CardDescription>
          </div>
          <Badge variant={statusVariant(provider.status)}>{provider.status}</Badge>
        </div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="Health" value={`${provider.healthScore}%`} />
          <Metric label="Latency" value={provider.avgResponseMs ? `${provider.avgResponseMs} ms` : "—"} />
          <Metric label="Quota" value={provider.quotaRemaining ?? "—"} />
          <Metric label="Requests vandaag" value={provider.requestsToday} />
          <Metric label="Success rate" value={`${provider.successRate}%`} />
          <Metric label="Bron" value={sourceLabel(provider.secretSource)} />
        </div>

        <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-medium text-muted-foreground">API Keys (encrypted vault)</p>
          {provider.maskedPreview ? (
            <p className="text-xs text-muted-foreground">
              Opgeslagen: <span className="font-mono">{provider.maskedPreview}</span>
            </p>
          ) : null}
          {provider.secretFields.map((field) => (
            <div key={field.key} className="space-y-1">
              <Label htmlFor={`${provider.id}-${field.key}`} className="text-xs">
                {field.label}
              </Label>
              <Input
                id={`${provider.id}-${field.key}`}
                type="password"
                autoComplete="off"
                placeholder={field.placeholder}
                value={secretDraft[field.key] ?? ""}
                onChange={(event) => onSecretChange(field.key, event.target.value)}
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              id={`${provider.id}-enabled`}
              type="checkbox"
              checked={provider.enabled}
              readOnly
              className="pointer-events-none opacity-60"
            />
            <Label htmlFor={`${provider.id}-enabled`} className="text-xs font-normal text-muted-foreground">
              Actief na opslaan
            </Label>
          </div>
        </div>

        {provider.lastError ? (
          <p className="truncate text-xs text-destructive" title={provider.lastError}>
            Laatste fout: {provider.lastError}
          </p>
        ) : null}

        {testResult ? (
          <p
            className={`text-xs ${testResult.success ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}
          >
            Test: {testResult.message} ({testResult.durationMs} ms)
          </p>
        ) : null}

        <div className="mt-auto grid grid-cols-2 gap-2">
          <Button size="sm" onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Opslaan
          </Button>
          <Button size="sm" variant="outline" onClick={onTest} disabled={isTesting || !provider.configured}>
            {isTesting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Test
          </Button>
          <Button size="sm" variant="outline" onClick={onRefreshHealth} disabled={isRefreshing}>
            {isRefreshing ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Refresh health
          </Button>
          <Button size="sm" variant="outline" onClick={onResetCache}>
            <Database className="size-4" />
            Reset cache
          </Button>
          {provider.secretSource === "vault" ? (
            <Button
              size="sm"
              variant="outline"
              className="col-span-2 text-destructive"
              onClick={onClear}
            >
              <Trash2 className="size-4" />
              Verwijder vault key
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as Record<string, unknown>;

  if (typeof record.message === "string") return record.message;

  const nested = record.error;
  if (nested && typeof nested === "object" && typeof (nested as { message?: string }).message === "string") {
    return (nested as { message: string }).message;
  }

  return fallback;
}

export function ProvidersSettingsClient() {
  const [providers, setProviders] = useState<ProviderSettingsSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [secretDrafts, setSecretDrafts] = useState<Record<string, Record<string, string>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [bulkTesting, setBulkTesting] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
  const [streamConnected, setStreamConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/settings/providers");
      const payload = (await response.json()) as {
        providers?: ProviderSettingsSnapshot[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "Providers laden mislukt"));
      }

      setProviders(payload.providers ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Onbekende fout");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  useEffect(() => {
    const source = new EventSource("/api/settings/providers/stream");
    eventSourceRef.current = source;

    source.addEventListener("connected", () => setStreamConnected(true));
    source.addEventListener("providers", (event) => {
      try {
        const payload = JSON.parse(event.data) as { providers?: ProviderSettingsSnapshot[] };
        if (payload.providers) setProviders(payload.providers);
      } catch {
        // ignore malformed events
      }
    });
    source.addEventListener("error", () => setStreamConnected(false));

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, []);

  const grouped = useMemo(() => {
    const groups: Record<string, ProviderSettingsSnapshot[]> = {
      search: [],
      crawler: [],
      ai: [],
    };

    for (const provider of providers) {
      groups[provider.category]?.push(provider);
    }

    return groups;
  }, [providers]);

  function updateSecretDraft(providerId: string, field: string, value: string) {
    setSecretDrafts((current) => ({
      ...current,
      [providerId]: { ...current[providerId], [field]: value },
    }));
  }

  async function handleSave(provider: ProviderSettingsSnapshot) {
    setSavingId(provider.id);
    setError(null);

    try {
      const secrets = secretDrafts[provider.id] ?? {};
      const response = await fetch(`/api/settings/providers/${provider.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true, secrets }),
      });

      const payload = (await response.json()) as {
        providers?: ProviderSettingsSnapshot[];
        message?: string;
      };

      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, "Opslaan mislukt"));
      }

      setProviders(payload.providers ?? []);
      setSecretDrafts((current) => ({ ...current, [provider.id]: {} }));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Opslaan mislukt");
    } finally {
      setSavingId(null);
    }
  }

  async function handleClear(providerId: string) {
    setSavingId(providerId);

    try {
      const response = await fetch(`/api/settings/providers/${providerId}`, { method: "DELETE" });
      const payload = (await response.json()) as { providers?: ProviderSettingsSnapshot[]; message?: string };

      if (!response.ok) throw new Error(apiErrorMessage(payload, "Verwijderen mislukt"));

      setProviders(payload.providers ?? []);
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : "Verwijderen mislukt");
    } finally {
      setSavingId(null);
    }
  }

  async function handleTest(providerId: string) {
    setTestingId(providerId);

    try {
      const response = await fetch(`/api/settings/providers/${providerId}/test`, { method: "POST" });
      const payload = (await response.json()) as { result?: TestResult; message?: string };

      if (!response.ok || !payload.result) {
        throw new Error(apiErrorMessage(payload, "Test mislukt"));
      }

      setTestResults((current) => ({ ...current, [providerId]: payload.result! }));
    } catch (testError) {
      setTestResults((current) => ({
        ...current,
        [providerId]: {
          providerId,
          success: false,
          durationMs: 0,
          message: testError instanceof Error ? testError.message : "Test mislukt",
        },
      }));
    } finally {
      setTestingId(null);
    }
  }

  async function handleRefreshHealth(providerId: string) {
    setRefreshingId(providerId);

    try {
      const response = await fetch(`/api/settings/providers/${providerId}/refresh-health`, {
        method: "POST",
      });
      const payload = (await response.json()) as { providers?: ProviderSettingsSnapshot[]; message?: string };

      if (!response.ok) throw new Error(apiErrorMessage(payload, "Refresh mislukt"));

      if (payload.providers) setProviders(payload.providers);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : "Refresh mislukt");
    } finally {
      setRefreshingId(null);
    }
  }

  async function handleResetCache(providerId: string) {
    try {
      await fetch(`/api/settings/providers/${providerId}/reset-cache`, { method: "POST" });
    } catch {
      setError("Cache reset mislukt");
    }
  }

  async function handleBulkHealthCheck() {
    setBulkTesting(true);

    try {
      const response = await fetch("/api/settings/providers/health-check", { method: "POST" });
      const payload = (await response.json()) as { providers?: ProviderSettingsSnapshot[]; message?: string };

      if (!response.ok) throw new Error(apiErrorMessage(payload, "Bulk test mislukt"));

      if (payload.providers) setProviders(payload.providers);
    } catch (bulkError) {
      setError(bulkError instanceof Error ? bulkError.message : "Bulk test mislukt");
    } finally {
      setBulkTesting(false);
    }
  }

  const configuredCount = providers.filter((provider) => provider.configured).length;
  const healthyCount = providers.filter((provider) => provider.status === "healthy").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Providers</h1>
          <p className="text-sm text-muted-foreground">
            Beheer API keys veilig in de vault. Geen .env nodig in productie — keys worden AES-256-GCM
            encrypted opgeslagen per organisatie.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={streamConnected ? "default" : "outline"} className="gap-1">
            {streamConnected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {streamConnected ? "Live" : "Offline"}
          </Badge>
          <Button variant="outline" onClick={() => void handleBulkHealthCheck()} disabled={bulkTesting}>
            {bulkTesting ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            Alle testen
          </Button>
          <Button variant="outline" onClick={() => void loadProviders()} disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Vernieuwen
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Providers</CardDescription>
            <CardTitle className="text-2xl">{providers.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Geconfigureerd</CardDescription>
            <CardTitle className="text-2xl">{configuredCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Healthy</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Activity className="size-5 text-emerald-500" />
              {healthyCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : null}

      {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((category) => {
        const items = grouped[category];
        if (!items?.length) return null;

        return (
          <section key={category} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{CATEGORY_LABELS[category]}</h2>
              <Separator className="mt-2" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((provider) => (
                <ProviderManagementCard
                  key={provider.id}
                  provider={provider}
                  secretDraft={secretDrafts[provider.id] ?? {}}
                  onSecretChange={(field, value) => updateSecretDraft(provider.id, field, value)}
                  onSave={() => void handleSave(provider)}
                  onClear={() => void handleClear(provider.id)}
                  onTest={() => void handleTest(provider.id)}
                  onResetCache={() => void handleResetCache(provider.id)}
                  onRefreshHealth={() => void handleRefreshHealth(provider.id)}
                  isSaving={savingId === provider.id}
                  isTesting={testingId === provider.id}
                  isRefreshing={refreshingId === provider.id}
                  testResult={testResults[provider.id]}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
