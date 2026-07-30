-- Support tickets — the backing store for The Port (/theport), the Pro-only
-- support portal.
--
-- Before this, "support" was a mailto: link on /contact. Nothing was
-- queryable: no way to know how many billing questions came in last month, no
-- way to show a user what they'd already asked, no way to tell a Pro member
-- their ticket was received. This table is the durable record; the Resend
-- email out to the support inbox is a notification on top of it, not the
-- system of record.
--
-- Ordering matters in the API: the row is written FIRST, then email is
-- attempted. src/lib/email-service.ts silently no-ops (and returns success)
-- when RESEND_API_KEY is unset, so a misconfigured environment would otherwise
-- swallow tickets with no trace. Persist-then-notify means the worst case is a
-- ticket nobody was paged about, not a ticket that never existed.

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Short human-quotable handle ("RC-4F91C2"). Users paste this into replies
  -- and we search on it, so it needs to survive being read aloud — hence hex
  -- rather than base64, and uppercase. 16.7M values over an expected ticket
  -- volume in the thousands; `unique` turns the remaining collision risk into
  -- a retryable insert error rather than a silent merge. Derived from
  -- gen_random_uuid() (core since PG13) rather than pgcrypto's
  -- gen_random_bytes, so this carries no extension dependency.
  ticket_ref text not null unique
    default 'RC-' || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6)),

  category text not null check (category in (
    'billing',           -- charges, plan changes, refunds
    'data_correction',   -- a spot is wrong, missing, or misplaced
    'bug',               -- something is broken
    'account',           -- login, email, deletion
    'forecast_question', -- "why is this score low"
    'feature_request',
    'other'
  )),

  subject text not null check (char_length(subject) between 3 and 200),
  body    text not null check (char_length(body) between 10 and 8000),

  status text not null default 'open' check (status in (
    'open', 'in_progress', 'waiting_on_user', 'resolved', 'closed'
  )),

  -- Set by us during triage, not by the submitter. Pro is the only tier that
  -- can file at all, so this ranks within Pro rather than encoding tier.
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),

  -- Everything the submitter shouldn't have to retype and we'd otherwise have
  -- to ask for: subscription tier/status at filing time, the page they came
  -- from, user agent, app build, and any spot slug the form was seeded with.
  -- Frozen at submission — deliberately NOT a live join, because "what tier
  -- were they on when they complained about billing" is the question that
  -- matters and today's tier can't answer it.
  context jsonb not null default '{}'::jsonb,

  -- Our reply, surfaced back to the user in The Port's ticket list.
  resolution_note text,
  resolved_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.support_tickets is
  'Pro support requests filed from /theport. Written before the notification email is attempted, so tickets survive a misconfigured RESEND_API_KEY.';
comment on column public.support_tickets.ticket_ref is
  'Short human-quotable handle (RC-XXXXXX) used in email subjects and user-facing lists.';
comment on column public.support_tickets.context is
  'Submission-time snapshot: tier, status, page, user agent, build, seeded spot. Frozen on purpose — today''s tier cannot answer "what were they paying when this happened".';

create index if not exists idx_support_tickets_user
  on public.support_tickets (user_id, created_at desc);
create index if not exists idx_support_tickets_status
  on public.support_tickets (status, created_at desc);
create index if not exists idx_support_tickets_category
  on public.support_tickets (category);

-- updated_at
create or replace function public.support_tickets_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists support_tickets_updated_at on public.support_tickets;
create trigger support_tickets_updated_at
  before update on public.support_tickets
  for each row
  execute function public.support_tickets_touch_updated_at();

-- RLS.
--
-- Every real write goes through /api/support/tickets holding the service role
-- key, which bypasses RLS entirely. These policies exist because the anon key
-- ships to the browser: they make direct PostgREST access from a signed-in
-- session harmless rather than useful.
--
-- Read-own is granted (harmless, and leaves the door open for a client-side
-- read later). Insert-own is granted but the API is the only caller, so the
-- Pro check lives there. There is deliberately NO update or delete policy:
-- status, priority and resolution_note are ours to set, and a user who could
-- flip their own ticket to 'urgent' — or delete the record of a billing
-- dispute — would make the queue meaningless.
alter table public.support_tickets enable row level security;

drop policy if exists "Users read own tickets" on public.support_tickets;
create policy "Users read own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

drop policy if exists "Users file own tickets" on public.support_tickets;
create policy "Users file own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);
