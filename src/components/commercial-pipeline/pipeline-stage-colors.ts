import type { CommercialPipelineStage } from "@/features/commercial-pipeline/domain/types";

export const PIPELINE_STAGE_ACCENT: Record<CommercialPipelineStage, string> = {
  nieuw: "border-slate-400/60 bg-slate-500/5",
  geanalyseerd: "border-blue-400/60 bg-blue-500/5",
  mail_klaar: "border-indigo-400/60 bg-indigo-500/5",
  mail_verzonden: "border-violet-400/60 bg-violet-500/5",
  reactie_ontvangen: "border-purple-400/60 bg-purple-500/5",
  interesse: "border-fuchsia-400/60 bg-fuchsia-500/5",
  intake_gepland: "border-pink-400/60 bg-pink-500/5",
  vacature_ontvangen: "border-rose-400/60 bg-rose-500/5",
  kandidaten_zoeken: "border-orange-400/60 bg-orange-500/5",
  voorstellen_gedaan: "border-amber-400/60 bg-amber-500/5",
  interview: "border-yellow-400/60 bg-yellow-500/5",
  plaatsing: "border-emerald-400/60 bg-emerald-500/5",
  verloren: "border-muted-foreground/30 bg-muted/40",
};

export const PIPELINE_STAGE_HEADER: Record<CommercialPipelineStage, string> = {
  nieuw: "text-slate-700 dark:text-slate-300",
  geanalyseerd: "text-blue-700 dark:text-blue-300",
  mail_klaar: "text-indigo-700 dark:text-indigo-300",
  mail_verzonden: "text-violet-700 dark:text-violet-300",
  reactie_ontvangen: "text-purple-700 dark:text-purple-300",
  interesse: "text-fuchsia-700 dark:text-fuchsia-300",
  intake_gepland: "text-pink-700 dark:text-pink-300",
  vacature_ontvangen: "text-rose-700 dark:text-rose-300",
  kandidaten_zoeken: "text-orange-700 dark:text-orange-300",
  voorstellen_gedaan: "text-amber-700 dark:text-amber-300",
  interview: "text-yellow-700 dark:text-yellow-300",
  plaatsing: "text-emerald-700 dark:text-emerald-300",
  verloren: "text-muted-foreground",
};
