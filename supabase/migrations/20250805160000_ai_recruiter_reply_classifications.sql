-- Expand reply classification categories for recruiter inbox intelligence

update public.ai_recruiter_replies set classification = 'interesse' where classification = 'positive';
update public.ai_recruiter_replies set classification = 'later' where classification = 'interested_later';
update public.ai_recruiter_replies set classification = 'interesse' where classification = 'referral';
update public.ai_recruiter_replies set classification = 'geen_interesse' where classification = 'not_interested';
update public.ai_recruiter_replies set classification = 'afgewezen' where classification = 'unsubscribe';
update public.ai_recruiter_replies set classification = 'automatisch_antwoord' where classification = 'bounce';
update public.ai_recruiter_replies set classification = 'onbekend' where classification = 'unknown';

alter table public.ai_recruiter_replies
  drop constraint if exists ai_recruiter_replies_classification_check;

alter table public.ai_recruiter_replies
  add constraint ai_recruiter_replies_classification_check
  check (classification in (
    'nieuwe_opdracht',
    'interesse',
    'later',
    'geen_interesse',
    'afgewezen',
    'automatisch_antwoord',
    'out_of_office',
    'spam',
    'onbekend'
  ));
