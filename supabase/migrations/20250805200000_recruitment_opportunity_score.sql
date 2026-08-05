-- Recruitment Intelligence — opportunity score columns for dashboard & prioritization

alter table public.recruitment_intelligence_analyses
  add column if not exists opportunity_score integer
    check (opportunity_score is null or (opportunity_score >= 0 and opportunity_score <= 100)),
  add column if not exists opportunity_tier text
    check (opportunity_tier is null or opportunity_tier in ('warm', 'interessant', 'lage_kans'));

create index if not exists recruitment_intelligence_analyses_org_tier_idx
  on public.recruitment_intelligence_analyses (organization_id, opportunity_tier)
  where is_current = true and opportunity_tier is not null;

create index if not exists recruitment_intelligence_analyses_org_score_idx
  on public.recruitment_intelligence_analyses (organization_id, opportunity_score desc nulls last)
  where is_current = true;

comment on column public.recruitment_intelligence_analyses.opportunity_score is
  'Recruitment Opportunity Score 0-100 — basis voor scoring, mail, dashboard en prioritering.';

comment on column public.recruitment_intelligence_analyses.opportunity_tier is
  'warm >=70, interessant >=40, lage_kans <40. Afgeleid van opportunity_score.';
