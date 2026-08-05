-- Extend AI Recruiter run item stages for contact discovery outcomes

alter table public.ai_recruiter_run_items
  drop constraint if exists ai_recruiter_run_items_stage_check;

alter table public.ai_recruiter_run_items
  add constraint ai_recruiter_run_items_stage_check
  check (stage in (
    'discovered',
    'validated',
    'enriched',
    'scored',
    'contact_found',
    'general_mailbox_found',
    'blocked_missing_contact',
    'contact_lookup_failed',
    'draft_created',
    'approved',
    'sent',
    'rejected',
    'skipped'
  ));
