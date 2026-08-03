-- Align vacancies with DATABASE.md / domain (not applied automatically).
alter table public.vacancies
  add column if not exists description text,
  add column if not exists salary_min integer check (salary_min is null or salary_min >= 0),
  add column if not exists salary_max integer check (salary_max is null or salary_max >= 0),
  add column if not exists requirements text,
  add column if not exists owner_id uuid references public.profiles (id) on delete set null;
