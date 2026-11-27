-- LinkedIn profile URL for candidate sourcing dedupe (public /in/ URLs only)

alter table public.candidates
  add column if not exists linkedin_url text;

create unique index if not exists candidates_org_linkedin_url_uidx
  on public.candidates (organization_id, linkedin_url)
  where linkedin_url is not null;