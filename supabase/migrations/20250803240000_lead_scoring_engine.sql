-- Lead Scoring Engine: Priority D + company_scores priority constraint

alter table public.companies drop constraint if exists companies_priority_check;

do $priority$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'companies' and column_name = 'priority'
  ) then
    alter table public.companies
      add constraint companies_priority_check check (priority is null or priority in ('A', 'B', 'C', 'D'));
  end if;
end
$priority$;

alter table public.company_scores drop constraint if exists company_scores_priority_check;

alter table public.company_scores
  add constraint company_scores_priority_check check (priority is null or priority in ('A', 'B', 'C', 'D'));

comment on column public.companies.score_breakdown is 'LeadScoreComponents JSON — deterministic scoring engine v2';
