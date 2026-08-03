import { groupTimelineItemsByPeriod } from "@/features/hiring-signals-timeline/domain/group-timeline-periods";
import {
  TIMELINE_FILTERS,
  type HiringSignalTimelineItem,
  type HiringSignalsTimelineResponse,
  type TimelineFilterId,
} from "@/features/hiring-signals-timeline/domain/timeline.types";
import type { HiringSignalsTimelineRepository } from "@/features/hiring-signals-timeline/repositories/hiring-signals-timeline.repository";
import {
  getSignalTypeLabel,
  type HiringSignalType,
} from "@/features/hiring-intelligence/domain/signal-types";
import type { AuthenticatedServiceContext } from "@/lib/api/authenticated-context";
import type { CompanyScore, HiringSignal } from "@/types/hiring-intelligence";

function mapSignalToTimelineItem(signal: HiringSignal): HiringSignalTimelineItem {
  return {
    id: signal.id,
    kind: "signal",
    title: signal.title ?? getSignalTypeLabel(signal.signal_type),
    description: signal.description,
    occurredAt: signal.observed_at,
    source: signal.source,
    sourceUrl: signal.source_url,
    confidence: signal.confidence,
    aiImpact: signal.ai_relevance,
    recruitmentImpact: signal.importance,
    signalType: signal.signal_type,
    typeLabel: getSignalTypeLabel(signal.signal_type),
    provider: signal.provider,
  };
}

function buildScoreChangeItems(history: CompanyScore[]): HiringSignalTimelineItem[] {
  const items: HiringSignalTimelineItem[] = [];

  for (let index = 0; index < history.length - 1; index += 1) {
    const current = history[index];
    const previous = history[index + 1];
    const delta = current.score - previous.score;

    if (delta === 0) continue;

    const sign = delta > 0 ? "+" : "";

    items.push({
      id: `score-${current.id}`,
      kind: "score_change",
      title: `AI score ${sign}${delta}`,
      description: current.score_reason,
      occurredAt: current.computed_at,
      source: "HireFlow AI",
      sourceUrl: null,
      confidence: null,
      aiImpact: Math.abs(delta),
      recruitmentImpact: Math.min(100, Math.abs(delta) * 2),
      scoreDelta: delta,
      typeLabel: "Score wijziging",
    });
  }

  return items;
}

export class HiringSignalsTimelineService {
  constructor(private readonly repository: HiringSignalsTimelineRepository) {}

  async getTimeline(
    context: AuthenticatedServiceContext,
    companyId: string,
    filter: TimelineFilterId,
  ): Promise<HiringSignalsTimelineResponse> {
    const signalTypes = TIMELINE_FILTERS[filter].types;

    const [signals, scoreHistory, watermark] = await Promise.all([
      this.repository.findSignalsByCompany(context.organizationId, companyId, {
        signalTypes: signalTypes as HiringSignalType[] | null,
      }),
      filter === "all"
        ? this.repository.findScoreHistory(context.organizationId, companyId)
        : Promise.resolve([]),
      this.repository.getTimelineWatermark(context.organizationId, companyId),
    ]);

    const signalItems = signals.map(mapSignalToTimelineItem);
    const scoreItems = buildScoreChangeItems(scoreHistory);
    const items = [...signalItems, ...scoreItems];
    const groups = groupTimelineItemsByPeriod(items);

    return {
      filter,
      groups,
      totalCount: items.length,
      generatedAt: new Date().toISOString(),
      watermark,
    };
  }

  async getWatermark(
    context: AuthenticatedServiceContext,
    companyId: string,
  ): Promise<string> {
    return this.repository.getTimelineWatermark(context.organizationId, companyId);
  }
}
