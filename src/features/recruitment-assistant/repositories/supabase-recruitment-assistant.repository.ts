import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  AtsCompanyInsight,
  QuietClientInsight,
  RecruitmentCallLead,
  RecruitmentCompanyInsight,
  RecruitmentInsightPeriod,
  RecruitmentRecruiterInsight,
  RecruitmentVacancyInsight,
  SimilarCompanyInsight,
  VacancyRoleInsight,
  WarmingLeadInsight,
} from "@/features/recruitment-assistant/domain/types";
import {
  RecruitmentAssistantRepositoryError,
  type RecruitmentAssistantRepository,
} from "@/features/recruitment-assistant/repositories/recruitment-assistant.repository";
import type { Database } from "@/types/database";
import type { CompanyIntelligence } from "@/types/hiring-intelligence";

function periodToIso(period: RecruitmentInsightPeriod): string {
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function todayStartIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function mapCompanyRow(row: CompanyIntelligence, rank: number, reason: string, evidence: string[]): RecruitmentCompanyInsight {
  return {
    rank,
    companyId: row.id,
    name: row.name,
    city: row.city,
    sector: row.sector,
    score: row.current_score,
    priority: row.current_priority,
    hiringIntensity: row.hiring_intensity ?? 0,
    signalCount: row.signal_count ?? 0,
    vacancyCount: 0,
    lastSignalAt: row.last_signal_at,
    outreachStatus: row.outreach_status,
    reason,
    evidence,
  };
}

export class SupabaseRecruitmentAssistantRepository implements RecruitmentAssistantRepository {
  constructor(private readonly client: SupabaseClient<Database>) {}

  private async loadCompanyNames(
    organizationId: string,
    companyIds: string[],
  ): Promise<Map<string, { name: string; sector: string | null; city: string | null }>> {
    const uniqueIds = [...new Set(companyIds.filter(Boolean))];
    const map = new Map<string, { name: string; sector: string | null; city: string | null }>();

    if (uniqueIds.length === 0) return map;

    const { data, error } = await this.client
      .from("companies")
      .select("id, name, sector, city")
      .eq("organization_id", organizationId)
      .in("id", uniqueIds);

    if (error) throw error;

    for (const row of data ?? []) {
      map.set(row.id as string, {
        name: row.name as string,
        sector: row.sector as string | null,
        city: row.city as string | null,
      });
    }

    return map;
  }

  async getTopGrowingCompanies(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<RecruitmentCompanyInsight[]> {
    const periodStart = periodToIso(period);

    const { data, error } = await this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("last_signal_at", periodStart)
      .order("hiring_intensity", { ascending: false, nullsFirst: false })
      .order("signal_count", { ascending: false, nullsFirst: false })
      .order("current_score", { ascending: false, nullsFirst: false })
      .limit(limit);

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    return ((data ?? []) as CompanyIntelligence[]).map((row, index) =>
      mapCompanyRow(
        row,
        index + 1,
        `Hiring intensity ${row.hiring_intensity ?? 0}, ${row.signal_count ?? 0} signalen in periode`,
        [
          `Hiring intensity: ${row.hiring_intensity ?? 0}`,
          `Signalen: ${row.signal_count ?? 0}`,
          row.last_signal_at ? `Laatste signaal: ${row.last_signal_at}` : "Geen recent signaal",
          row.current_score !== null ? `Lead score: ${row.current_score}` : "Niet gescoord",
        ],
      ),
    );
  }

  async getCompaniesWithNewVacancies(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<RecruitmentVacancyInsight[]> {
    const periodStart = periodToIso(period);

    const { data, error } = await this.client
      .from("vacancies")
      .select("id, title, company_id, created_at, location")
      .eq("organization_id", organizationId)
      .gte("created_at", periodStart)
      .neq("status", "closed")
      .order("created_at", { ascending: false });

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNames(
      organizationId,
      rows.map((row) => row.company_id as string),
    );

    const grouped = new Map<
      string,
      {
        companyId: string;
        companyName: string;
        sector: string | null;
        city: string | null;
        vacancyCount: number;
        latestTitle: string | null;
        latestAt: string | null;
      }
    >();

    for (const row of rows) {
      const companyId = row.company_id as string;
      const company = companyNames.get(companyId);
      const existing = grouped.get(companyId);

      if (!existing) {
        grouped.set(companyId, {
          companyId,
          companyName: company?.name ?? "Onbekend bedrijf",
          sector: company?.sector ?? null,
          city: company?.city ?? (row.location as string | null),
          vacancyCount: 1,
          latestTitle: row.title as string,
          latestAt: row.created_at as string,
        });
        continue;
      }

      existing.vacancyCount += 1;
    }

    return [...grouped.values()]
      .sort((a, b) => b.vacancyCount - a.vacancyCount || (b.latestAt ?? "").localeCompare(a.latestAt ?? ""))
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        companyId: row.companyId,
        companyName: row.companyName,
        vacancyCount: row.vacancyCount,
        latestVacancyTitle: row.latestTitle,
        latestVacancyAt: row.latestAt,
        city: row.city,
        sector: row.sector,
      }));
  }

  async getCompaniesHiringRecruiters(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<RecruitmentRecruiterInsight[]> {
    const periodStart = periodToIso(period);

    const { data, error } = await this.client
      .from("hiring_signals")
      .select("id, company_id, signal_type, title, observed_at, source_url")
      .eq("organization_id", organizationId)
      .in("signal_type", ["new_recruiter", "new_hr_manager"])
      .gte("observed_at", periodStart)
      .order("observed_at", { ascending: false })
      .limit(limit * 3);

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNames(
      organizationId,
      rows.map((row) => row.company_id as string | null).filter(Boolean) as string[],
    );

    const seen = new Set<string>();
    const results: RecruitmentRecruiterInsight[] = [];

    for (const row of rows) {
      const companyId = row.company_id as string | null;
      if (!companyId || seen.has(companyId)) continue;

      seen.add(companyId);
      const company = companyNames.get(companyId);

      results.push({
        rank: results.length + 1,
        companyId,
        companyName: company?.name ?? "Onbekend bedrijf",
        signalType: row.signal_type as string,
        title: row.title as string | null,
        observedAt: row.observed_at as string,
        sourceUrl: row.source_url as string | null,
      });

      if (results.length >= limit) break;
    }

    return results;
  }

  async getLeadsToCallToday(organizationId: string, limit: number): Promise<RecruitmentCallLead[]> {
    const todayStart = todayStartIso();
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data, error } = await this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .gte("current_score", 55)
      .in("current_priority", ["A", "B"])
      .order("current_score", { ascending: false, nullsFirst: false })
      .limit(100);

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const candidates = ((data ?? []) as CompanyIntelligence[])
      .filter((row) => {
        const outreach = row.outreach_status ?? "none";
        const recentSignal =
          row.last_signal_at !== null && row.last_signal_at >= twoWeeksAgo.toISOString();
        const activeHiring = (row.hiring_intensity ?? 0) >= 40;
        return ["none", "draft", "queued"].includes(outreach) && (recentSignal || activeHiring);
      })
      .slice(0, limit);

    return candidates.map((row, index) => {
      const outreach = row.outreach_status ?? "none";
      let callReason = `Priority ${row.current_priority} lead met score ${row.current_score}`;

      if (outreach === "draft") {
        callReason = "Outreach concept klaar — follow-up bellen";
      } else if ((row.hiring_intensity ?? 0) >= 70) {
        callReason = `Hoge hiring activiteit (${row.hiring_intensity}) — warme lead`;
      } else if (row.last_signal_at && row.last_signal_at >= todayStart) {
        callReason = "Nieuw hiring signaal vandaag gedetecteerd";
      }

      return {
        rank: index + 1,
        companyId: row.id,
        name: row.name,
        score: row.current_score,
        priority: row.current_priority,
        city: row.city,
        sector: row.sector,
        outreachStatus: row.outreach_status,
        hiringIntensity: row.hiring_intensity ?? 0,
        lastSignalAt: row.last_signal_at,
        callReason,
        aiSummary: row.current_ai_summary,
      };
    });
  }

  async findSimilarCompanies(
    organizationId: string,
    companyName: string,
    limit: number,
  ): Promise<{ referenceCompany: RecruitmentCompanyInsight | null; similar: SimilarCompanyInsight[] }> {
    const { data: referenceRows, error: referenceError } = await this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .ilike("name", `%${companyName.trim()}%`)
      .limit(1);

    if (referenceError) {
      throw new RecruitmentAssistantRepositoryError(referenceError.message);
    }

    const reference = (referenceRows?.[0] ?? null) as CompanyIntelligence | null;

    if (!reference) {
      return { referenceCompany: null, similar: [] };
    }

    let query = this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .neq("id", reference.id)
      .limit(100);

    if (reference.sector) {
      query = query.ilike("sector", `%${reference.sector}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const referenceScore = reference.current_score ?? 0;
    const referenceIntensity = reference.hiring_intensity ?? 0;

    const similar = ((data ?? []) as CompanyIntelligence[])
      .map((row) => {
        let similarityScore = 0;
        const reasons: string[] = [];

        if (reference.sector && row.sector && row.sector.toLowerCase() === reference.sector.toLowerCase()) {
          similarityScore += 40;
          reasons.push(`Zelfde sector: ${row.sector}`);
        } else if (reference.sector && row.sector) {
          similarityScore += 15;
          reasons.push(`Vergelijkbare sector: ${row.sector}`);
        }

        if (reference.city && row.city && row.city.toLowerCase() === reference.city.toLowerCase()) {
          similarityScore += 25;
          reasons.push(`Zelfde stad: ${row.city}`);
        }

        const scoreDelta = Math.abs((row.current_score ?? 0) - referenceScore);
        if (scoreDelta <= 10) {
          similarityScore += 20;
          reasons.push(`Vergelijkbare lead score (${row.current_score ?? "—"})`);
        } else if (scoreDelta <= 20) {
          similarityScore += 10;
        }

        const intensityDelta = Math.abs((row.hiring_intensity ?? 0) - referenceIntensity);
        if (intensityDelta <= 15) {
          similarityScore += 15;
          reasons.push(`Vergelijkbare hiring intensity (${row.hiring_intensity ?? 0})`);
        }

        return {
          rank: 0,
          companyId: row.id,
          name: row.name,
          city: row.city,
          sector: row.sector,
          score: row.current_score,
          hiringIntensity: row.hiring_intensity ?? 0,
          similarityScore,
          similarityReasons: reasons,
        } satisfies SimilarCompanyInsight;
      })
      .filter((row) => row.similarityScore > 0)
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, limit)
      .map((row, index) => ({ ...row, rank: index + 1 }));

    return {
      referenceCompany: mapCompanyRow(
        reference,
        0,
        `Referentiebedrijf voor vergelijking`,
        [`Sector: ${reference.sector ?? "—"}`, `Stad: ${reference.city ?? "—"}`, `Score: ${reference.current_score ?? "—"}`],
      ),
      similar,
    };
  }

  async getWarmingLeads(
    organizationId: string,
    limit: number,
    period: RecruitmentInsightPeriod,
    minDelta = 5,
  ): Promise<WarmingLeadInsight[]> {
    const periodStart = periodToIso(period);

    const { data: scoreRows, error } = await this.client
      .from("company_scores")
      .select("company_id, score, computed_at")
      .eq("organization_id", organizationId)
      .gte("computed_at", periodStart)
      .order("computed_at", { ascending: false });

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const grouped = new Map<string, Array<{ score: number; computedAt: string }>>();

    for (const row of scoreRows ?? []) {
      const companyId = row.company_id as string;
      const entries = grouped.get(companyId) ?? [];
      if (entries.length < 2) {
        entries.push({
          score: row.score as number,
          computedAt: row.computed_at as string,
        });
        grouped.set(companyId, entries);
      }
    }

    const warmingCompanyIds = [...grouped.entries()]
      .map(([companyId, entries]) => {
        const current = entries[0];
        const previous = entries[1];
        const delta = current.score - previous.score;
        return { companyId, current, previous, delta };
      })
      .filter((entry) => entry.delta >= minDelta)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, limit);

    if (warmingCompanyIds.length === 0) return [];

    const { data: intelligenceRows } = await this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .in(
        "id",
        warmingCompanyIds.map((entry) => entry.companyId),
      );

    const intelligenceMap = new Map(
      ((intelligenceRows ?? []) as CompanyIntelligence[]).map((row) => [row.id, row]),
    );

    return warmingCompanyIds.map((entry, index) => {
      const row = intelligenceMap.get(entry.companyId);
      const name = row?.name ?? "Onbekend bedrijf";

      return {
        rank: index + 1,
        companyId: entry.companyId,
        name,
        city: row?.city ?? null,
        sector: row?.sector ?? null,
        previousScore: entry.previous.score,
        currentScore: entry.current.score,
        scoreDelta: entry.delta,
        priority: row?.current_priority ?? null,
        hiringIntensity: row?.hiring_intensity ?? 0,
        lastSignalAt: row?.last_signal_at ?? null,
        warmedAt: entry.current.computedAt,
        evidence: [
          `Score: ${entry.previous.score} → ${entry.current.score} (+${entry.delta})`,
          `Bijgewerkt: ${entry.current.computedAt}`,
          row?.last_signal_at ? `Laatste signaal: ${row.last_signal_at}` : "Geen recent signaal",
          row?.current_priority ? `Prioriteit: ${row.current_priority}` : "Geen prioriteit",
        ],
      } satisfies WarmingLeadInsight;
    });
  }

  async getQuietClients(
    organizationId: string,
    limit: number,
    quietDays: number,
  ): Promise<QuietClientInsight[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - quietDays);
    const cutoffIso = cutoff.toISOString();

    const { data, error } = await this.client
      .from("companies_intelligence")
      .select("*")
      .eq("organization_id", organizationId)
      .neq("status", "archived")
      .order("last_signal_at", { ascending: true, nullsFirst: true })
      .limit(200);

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const now = Date.now();

    const quiet = ((data ?? []) as CompanyIntelligence[])
      .filter((row) => {
        const lastSignal = row.last_signal_at;
        const isQuiet = !lastSignal || lastSignal < cutoffIso;
        const wasActive =
          (row.signal_count ?? 0) > 0 ||
          ["sent", "approved"].includes(row.outreach_status ?? "") ||
          (row.current_score ?? 0) >= 45;
        return isQuiet && wasActive;
      })
      .slice(0, limit);

    return quiet.map((row, index) => {
      const daysSinceSignal = row.last_signal_at
        ? Math.floor((now - new Date(row.last_signal_at).getTime()) / 86_400_000)
        : null;

      let quietReason = "Geen hiring activiteit in de stilteperiode";
      if (row.outreach_status === "sent") {
        quietReason = "Outreach verstuurd maar geen nieuwe signalen sindsdien";
      } else if ((row.signal_count ?? 0) > 0) {
        quietReason = "Eerder actieve hiring signals, nu stil";
      } else if ((row.current_score ?? 0) >= 55) {
        quietReason = "Warme lead zonder recente activiteit";
      }

      return {
        rank: index + 1,
        companyId: row.id,
        name: row.name,
        city: row.city,
        sector: row.sector,
        score: row.current_score,
        priority: row.current_priority,
        lastSignalAt: row.last_signal_at,
        daysSinceSignal,
        outreachStatus: row.outreach_status,
        signalCount: row.signal_count ?? 0,
        quietReason,
        evidence: [
          row.last_signal_at
            ? `Laatste signaal: ${row.last_signal_at} (${daysSinceSignal} dagen geleden)`
            : "Nooit een signaal geregistreerd",
          `Signalen totaal: ${row.signal_count ?? 0}`,
          `Outreach status: ${row.outreach_status ?? "none"}`,
          row.current_score !== null ? `Lead score: ${row.current_score}` : "Niet gescoord",
        ],
      } satisfies QuietClientInsight;
    });
  }

  async getCompaniesByAts(
    organizationId: string,
    atsName: string,
    limit: number,
  ): Promise<AtsCompanyInsight[]> {
    const needle = atsName.trim().toLowerCase();

    const { data, error } = await this.client
      .from("hiring_signals")
      .select("id, company_id, signal_type, title, description, source_url, observed_at, payload")
      .eq("organization_id", organizationId)
      .not("company_id", "is", null)
      .or(`signal_type.eq.ats_detected,description.ilike.%${needle}%,source_url.ilike.%${needle}%`)
      .order("observed_at", { ascending: false })
      .limit(limit * 5);

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const rows = (data ?? []).filter((row) => {
      const haystack = `${row.description ?? ""} ${row.source_url ?? ""} ${JSON.stringify(row.payload ?? {})}`.toLowerCase();
      return row.signal_type === "ats_detected" || haystack.includes(needle);
    });

    const companyNames = await this.loadCompanyNames(
      organizationId,
      rows.map((row) => row.company_id as string),
    );

    const seen = new Set<string>();
    const results: AtsCompanyInsight[] = [];

    for (const row of rows) {
      const companyId = row.company_id as string;
      if (seen.has(companyId)) continue;

      seen.add(companyId);
      const company = companyNames.get(companyId);

      results.push({
        rank: results.length + 1,
        companyId,
        name: company?.name ?? "Onbekend bedrijf",
        city: company?.city ?? null,
        sector: company?.sector ?? null,
        atsName: atsName.trim(),
        detectedAt: row.observed_at as string,
        sourceUrl: row.source_url as string | null,
        evidence: [
          `Signaal type: ${row.signal_type as string}`,
          row.title ? `Titel: ${row.title as string}` : "ATS gedetecteerd in hiring signal",
          row.source_url ? `Bron: ${row.source_url as string}` : "Geen bron-URL",
          `Waargenomen: ${row.observed_at as string}`,
        ],
      });

      if (results.length >= limit) break;
    }

    return results;
  }

  async getCompaniesByVacancyRole(
    organizationId: string,
    roleTitle: string,
    limit: number,
    period: RecruitmentInsightPeriod,
  ): Promise<VacancyRoleInsight[]> {
    const periodStart = periodToIso(period);
    const needle = roleTitle.trim();

    const { data, error } = await this.client
      .from("vacancies")
      .select("id, title, company_id, created_at, location")
      .eq("organization_id", organizationId)
      .ilike("title", `%${needle}%`)
      .gte("created_at", periodStart)
      .neq("status", "closed")
      .order("created_at", { ascending: false });

    if (error) {
      throw new RecruitmentAssistantRepositoryError(error.message);
    }

    const rows = data ?? [];
    const companyNames = await this.loadCompanyNames(
      organizationId,
      rows.map((row) => row.company_id as string),
    );

    const grouped = new Map<
      string,
      {
        companyId: string;
        companyName: string;
        sector: string | null;
        city: string | null;
        titles: string[];
        latestAt: string | null;
      }
    >();

    for (const row of rows) {
      const companyId = row.company_id as string;
      const company = companyNames.get(companyId);
      const existing = grouped.get(companyId);

      if (!existing) {
        grouped.set(companyId, {
          companyId,
          companyName: company?.name ?? "Onbekend bedrijf",
          sector: company?.sector ?? null,
          city: company?.city ?? (row.location as string | null),
          titles: [row.title as string],
          latestAt: row.created_at as string,
        });
        continue;
      }

      existing.titles.push(row.title as string);
    }

    return [...grouped.values()]
      .sort((a, b) => b.titles.length - a.titles.length)
      .slice(0, limit)
      .map((row, index) => ({
        rank: index + 1,
        companyId: row.companyId,
        companyName: row.companyName,
        vacancyCount: row.titles.length,
        matchingTitles: [...new Set(row.titles)].slice(0, 5),
        latestVacancyAt: row.latestAt,
        city: row.city,
        sector: row.sector,
        evidence: [
          `${row.titles.length} vacature(s) met "${needle}" in titel`,
          `Titels: ${[...new Set(row.titles)].slice(0, 3).join(", ")}`,
          row.latestAt ? `Laatste vacature: ${row.latestAt}` : "Onbekend",
        ],
      }));
  }
}
