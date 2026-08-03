-- Discovery quality metadata for Company Finder saves

alter table public.companies
  add column if not exists company_type text,
  add column if not exists company_confidence integer,
  add column if not exists discovery_reason text,
  add column if not exists discovery_provider text;

comment on column public.companies.company_type is
  'Discovery classification: company_website, holding, agency, directory, news, government, spam';

comment on column public.companies.company_confidence is
  'Discovery quality score 0-100; saves require >= 60';

comment on column public.companies.discovery_reason is
  'Why this company passed or failed discovery quality gates';

comment on column public.companies.discovery_provider is
  'Search provider used for discovery (e.g. tavily)';

create index if not exists companies_discovery_provider_idx
  on public.companies (organization_id, discovery_provider)
  where discovery_provider is not null;

create index if not exists companies_company_confidence_idx
  on public.companies (organization_id, company_confidence desc nulls last)
  where company_confidence is not null;
