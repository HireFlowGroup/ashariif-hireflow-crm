-- Hiring Signals Engine: canonical signal types + importance / AI relevance

-- Migrate legacy signal types to canonical types
update public.hiring_signals set signal_type = 'vacancy' where signal_type in ('vacancy_detected', 'hiring_activity');
update public.hiring_signals set signal_type = 'indeed_vacancy' where signal_type = 'indeed_listing';
update public.hiring_signals set signal_type = 'careers_page' where signal_type in ('careers_page_found', 'hiring_page_found', 'werkenbij_listing');
update public.hiring_signals set signal_type = 'linkedin_hiring' where signal_type in ('linkedin_company_found', 'contact_discovered');
update public.hiring_signals set signal_type = 'google_maps_change' where signal_type in ('maps_listing', 'location_confirmed');
update public.hiring_signals set signal_type = 'website_change' where signal_type in ('website_enriched', 'email_found', 'phone_found');
update public.hiring_signals set signal_type = 'news' where signal_type in ('sector_hint', 'employee_count_hint', 'kvk_found');
update public.hiring_signals set signal_type = 'vacancy' where signal_type = 'company_discovered';

alter table public.hiring_signals drop constraint if exists hiring_signals_signal_type_check;

alter table public.hiring_signals
  add column if not exists importance integer not null default 50
    check (importance >= 0 and importance <= 100),
  add column if not exists ai_relevance integer not null default 50
    check (ai_relevance >= 0 and ai_relevance <= 100),
  add column if not exists source text;

-- Backfill source from provider
update public.hiring_signals
set source = provider
where source is null;

alter table public.hiring_signals
  add constraint hiring_signals_signal_type_check check (
    signal_type in (
      'vacancy',
      'new_location',
      'new_recruiter',
      'new_hr_manager',
      'funding',
      'website_change',
      'news',
      'linkedin_hiring',
      'ats_detected',
      'careers_page',
      'indeed_vacancy',
      'google_maps_change'
    )
  );

create index if not exists hiring_signals_org_importance_idx
  on public.hiring_signals (organization_id, importance desc, observed_at desc);

create index if not exists hiring_signals_org_ai_relevance_idx
  on public.hiring_signals (organization_id, ai_relevance desc);

create index if not exists hiring_signals_company_type_idx
  on public.hiring_signals (company_id, signal_type, observed_at desc)
  where company_id is not null;

-- Upsert helper: merge signal on fingerprint conflict
create or replace function public.upsert_hiring_signal(
  p_organization_id uuid,
  p_company_id uuid,
  p_job_id uuid,
  p_provider text,
  p_signal_type text,
  p_fingerprint text,
  p_title text,
  p_description text,
  p_source_url text,
  p_source text,
  p_confidence numeric,
  p_importance integer,
  p_ai_relevance integer,
  p_external_id text,
  p_payload jsonb,
  p_extracted_fields jsonb,
  p_observed_at timestamptz
)
returns public.hiring_signals
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.hiring_signals%rowtype;
  v_result public.hiring_signals%rowtype;
begin
  select * into v_existing
  from public.hiring_signals
  where organization_id = p_organization_id
    and fingerprint = p_fingerprint;

  if found then
    update public.hiring_signals
    set
      company_id = coalesce(p_company_id, v_existing.company_id),
      job_id = coalesce(p_job_id, v_existing.job_id),
      title = coalesce(nullif(p_title, ''), v_existing.title),
      description = case
        when length(coalesce(p_description, '')) > length(coalesce(v_existing.description, ''))
          then p_description
        else v_existing.description
      end,
      source_url = coalesce(nullif(p_source_url, ''), v_existing.source_url),
      source = coalesce(nullif(p_source, ''), v_existing.source),
      confidence = greatest(coalesce(v_existing.confidence, 0), coalesce(p_confidence, 0)),
      importance = greatest(v_existing.importance, coalesce(p_importance, 0)),
      ai_relevance = greatest(v_existing.ai_relevance, coalesce(p_ai_relevance, 0)),
      external_id = coalesce(p_external_id, v_existing.external_id),
      payload = coalesce(p_payload, v_existing.payload),
      extracted_fields = coalesce(p_extracted_fields, '{}'::jsonb) || coalesce(v_existing.extracted_fields, '{}'::jsonb),
      observed_at = greatest(v_existing.observed_at, coalesce(p_observed_at, now())),
      status = 'processed',
      processed_at = now(),
      updated_at = now()
    where id = v_existing.id
    returning * into v_result;

    perform public.apply_hiring_signal_to_company(v_result.id);
    return v_result;
  end if;

  insert into public.hiring_signals (
    organization_id, company_id, job_id, provider, signal_type, status,
    external_id, source_url, fingerprint, title, description,
    confidence, importance, ai_relevance, source,
    payload, extracted_fields, observed_at, processed_at
  )
  values (
    p_organization_id, p_company_id, p_job_id, p_provider, p_signal_type, 'pending',
    p_external_id, p_source_url, p_fingerprint, p_title, p_description,
    p_confidence, coalesce(p_importance, 50), coalesce(p_ai_relevance, 50), p_source,
    coalesce(p_payload, '{}'::jsonb), coalesce(p_extracted_fields, '{}'::jsonb),
    coalesce(p_observed_at, now()), null
  )
  returning * into v_result;

  if v_result.company_id is not null then
    perform public.apply_hiring_signal_to_company(v_result.id);
  end if;

  return v_result;
end;
$$;

-- Update company hiring intensity for new signal types
create or replace function public.apply_hiring_signal_to_company(p_signal_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_signal public.hiring_signals%rowtype;
  v_fields jsonb;
  v_conf numeric;
  v_intensity_boost integer;
begin
  select * into v_signal from public.hiring_signals where id = p_signal_id;
  if not found or v_signal.company_id is null then return; end if;

  v_fields := coalesce(v_signal.extracted_fields, '{}'::jsonb);
  v_conf := coalesce(v_signal.confidence, 0.5);

  v_intensity_boost := case v_signal.signal_type
    when 'vacancy' then 15
    when 'indeed_vacancy' then 15
    when 'new_recruiter' then 12
    when 'new_hr_manager' then 12
    when 'linkedin_hiring' then 10
    when 'ats_detected' then 14
    when 'careers_page' then 10
    when 'new_location' then 8
    when 'funding' then 6
    when 'google_maps_change' then 5
    else 3
  end;

  update public.companies c
  set
    name = coalesce(nullif(v_fields->>'name', ''), c.name),
    website = case when v_fields ? 'website' then nullif(v_fields->>'website', '') else c.website end,
    domain = case when v_fields ? 'domain' then nullif(v_fields->>'domain', '') else c.domain end,
    linkedin_url = case when v_fields ? 'linkedin_url' then nullif(v_fields->>'linkedin_url', '') else c.linkedin_url end,
    email = case when v_fields ? 'email' then nullif(v_fields->>'email', '') else c.email end,
    general_email = case when v_fields ? 'general_email' then nullif(v_fields->>'general_email', '') else c.general_email end,
    hr_email = case when v_fields ? 'hr_email' then nullif(v_fields->>'hr_email', '') else c.hr_email end,
    phone = case when v_fields ? 'phone' then nullif(v_fields->>'phone', '') else c.phone end,
    sector = case when v_fields ? 'sector' then nullif(v_fields->>'sector', '') else c.sector end,
    city = case when v_fields ? 'city' then nullif(v_fields->>'city', '') else c.city end,
    region = case when v_fields ? 'region' then nullif(v_fields->>'region', '') else c.region end,
    province = case when v_fields ? 'province' then nullif(v_fields->>'province', '') else c.province end,
    country = case when v_fields ? 'country' then nullif(v_fields->>'country', '') else c.country end,
    careers_url = case when v_fields ? 'careers_url' then nullif(v_fields->>'careers_url', '') else c.careers_url end,
    vacancy_page_url = case when v_fields ? 'vacancy_page_url' then nullif(v_fields->>'vacancy_page_url', '') else c.vacancy_page_url end,
    kvk_number = case when v_fields ? 'kvk_number' then nullif(v_fields->>'kvk_number', '') else c.kvk_number end,
    source = coalesce(nullif(v_fields->>'source', ''), c.source, v_signal.source, v_signal.provider),
    source_url = coalesce(nullif(v_signal.source_url, ''), c.source_url),
    confidence = greatest(coalesce(c.confidence, 0), v_conf),
    last_verified_at = greatest(coalesce(c.last_verified_at, v_signal.observed_at), v_signal.observed_at),
    last_signal_at = greatest(coalesce(c.last_signal_at, v_signal.observed_at), v_signal.observed_at),
    signal_count = c.signal_count + 1,
    hiring_intensity = least(100, c.hiring_intensity + v_intensity_boost),
    updated_at = now()
  where c.id = v_signal.company_id;

  update public.hiring_signals
  set status = 'processed', processed_at = now(), updated_at = now()
  where id = p_signal_id and status <> 'processed';
end;
$$;
