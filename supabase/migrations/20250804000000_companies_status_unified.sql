-- Unify companies.status: legacy NL CRM pipeline + HireFlow standard values.

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
      'prospect'
    )
  );

comment on constraint companies_status_check on public.companies is
  'NL CRM pipeline statuses + HireFlow standard (prospect/active/inactive).';
