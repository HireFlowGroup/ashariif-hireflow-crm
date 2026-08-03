-- Recruitment-first Lead Intelligence: extended company fields

alter table public.companies
  add column if not exists province text,
  add column if not exists careers_url text,
  add column if not exists vacancy_page_url text,
  add column if not exists general_email text,
  add column if not exists hr_email text,
  add column if not exists kvk_number text,
  add column if not exists ai_summary text;

create index if not exists companies_org_kvk_idx
  on public.companies (organization_id, kvk_number)
  where kvk_number is not null;
