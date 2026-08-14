-- Offer claims: "I arrived through an offer link and want the deal".
--
-- A claim is a REQUEST, not a grant. Nothing here touches the billing columns,
-- and no entitlement gate reads these columns. The grant itself is still the
-- ordinary comp write from the bluecaster admin (see 20260727_pro_comp_and_welcome),
-- which is what keeps a shareable URL from being a self-serve paywall bypass.
--
-- Why store the claim on user_settings rather than a requests table: the queue
-- is "who claimed and has not been granted yet", which is two columns and a
-- partial index. A separate table would need its own RLS, its own service-role
-- policy, and a join on every read, to hold one string per account.

alter table public.user_settings
  add column if not exists offer_code text,
  add column if not exists offer_code_at timestamptz,
  add column if not exists offer_granted_at timestamptz;

comment on column public.user_settings.offer_code is
  'Offer link this account arrived through (e.g. "first"). Write-once: the first claim wins, so a later visit to a different offer page cannot overwrite the one an admin is about to action.';
comment on column public.user_settings.offer_code_at is
  'When the claim was recorded. Also the write-once guard for offer_code.';
comment on column public.user_settings.offer_granted_at is
  'When an admin approved the claim. Non-null means the queue is done with this row — it does NOT mean the comp is still live, which is what comp_expires_at is for. Kept separate so a comp lapsing a year later cannot resurrect the claim into the pending queue.';

-- The queue read: pending claims, newest first. Partial because granted rows
-- are the vast majority over time and none of them are ever queried this way.
create index if not exists user_settings_pending_offer_idx
  on public.user_settings (offer_code_at desc)
  where offer_code is not null and offer_granted_at is null;

-- These are admin-actioned columns, so they get the same treatment as the
-- billing columns: not client-writable. Without this, anyone holding the anon
-- key could stamp `offer_granted_at` on their own row and drop themselves out
-- of the queue, or rewrite `offer_code` to whichever offer is most generous.
--
-- Recreated wholesale rather than altered — this is the same function shipped
-- in 20260727_pro_comp_and_welcome.sql with three columns added to the list.
create or replace function public.user_settings_block_billing_self_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The service role bypasses RLS and owns every legitimate billing write.
  if coalesce(current_setting('request.jwt.claims', true)::json ->> 'role', '') = 'service_role' then
    return new;
  end if;
  -- Direct psql / migrations / cron run without a JWT at all.
  if current_setting('request.jwt.claims', true) is null then
    return new;
  end if;

  if new.subscription_tier    is distinct from old.subscription_tier
     or new.subscription_status      is distinct from old.subscription_status
     or new.subscription_period_end  is distinct from old.subscription_period_end
     or new.stripe_customer_id       is distinct from old.stripe_customer_id
     or new.stripe_subscription_id   is distinct from old.stripe_subscription_id
     or new.comp_expires_at          is distinct from old.comp_expires_at
     or new.comp_reason              is distinct from old.comp_reason
     or new.offer_code               is distinct from old.offer_code
     or new.offer_code_at            is distinct from old.offer_code_at
     or new.offer_granted_at         is distinct from old.offer_granted_at then
    raise exception 'billing columns on user_settings are not client-writable'
      using errcode = '42501';
  end if;

  return new;
end;
$$;
