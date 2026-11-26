-- Consolidation phase 1: Review status for mid-confidence discovery (additive only)
-- Does NOT drop/alter existing production data destructively.

comment on column public.companies.company_confidence is
  'Discovery AI confidence 0-100; >70 = company, 50-70 = Review';

alter table public.companies drop constraint if exists companies_status_check;

alter table public.companies
  add constraint companies_status_check check (
    status in (
      'Nieuw',
      'Gemaild',
      'Reactie',
      'Gesprek',
      'Offerte',
      'Klant',
      'active',
      'inactive',
      'prospect',
      'Review'
    )
  );

comment on constraint companies_status_check on public.companies is
  'NL CRM pipeline statuses + HireFlow standard + Review for mid-confidence discovery.';

create index if not exists companies_status_review_idx
  on public.companies (organization_id, status)
  where status in ('Review', 'review');
