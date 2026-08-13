-- Saved spots — the durable home for the star on a spot card.
--
-- Favourites used to live only in `localStorage` under `rc-fav:<slug>`. That
-- made them per-browser (no sync, invisible on a second device), unreadable by
-- anything server-side, and — because a bad write looked exactly like a
-- deliberate one — unrepairable except by wiping the lot, which is what
-- reelcaster-frontend #259 had to do after /explore spent weeks starring spots
-- nobody chose.
--
-- This is NOT the older `favorite_spots` table. That one stores an arbitrary
-- place (a name and a lat/lon the user typed) and today feeds only the
-- default-location picker; it is a saved-*locations* list that predates the
-- curated-spot model and kept its confusing name. This table stores a
-- reference to a real spot, and nothing else.
--
-- The reference is a slug, not a foreign key: spots live in BlueCaster's
-- database, not this one, so there is no FK to declare and nothing here can
-- cascade from a spot being deleted. A row for a spot that no longer resolves
-- is simply skipped when the list is rendered.
create table if not exists public.user_favorite_spots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- The BlueCaster spot slug. This is the key every consumer surface already
  -- uses (`/explore/spot/<slug>`), so it is what the client sends and reads.
  spot_slug text not null,

  -- The BlueCaster spot id, when the caller knew it. Nullable and unenforced —
  -- purely a repair handle. Slugs carry a name (`oak-bay-flats-ms20jgs9`), so a
  -- spot that gets renamed and re-slugged would otherwise strand every
  -- favourite pointing at it with no way to work out what was meant.
  spot_id uuid,

  created_at timestamptz not null default now(),

  -- Starring the same spot twice is the same fact, not two of them. This is
  -- also what lets the API treat POST as idempotent (on conflict do nothing)
  -- instead of racing two taps into duplicate rows and a wrong count.
  constraint user_favorite_spots_user_slug_unique unique (user_id, spot_slug)
);

comment on table public.user_favorite_spots is
  'Spots a user has starred. References BlueCaster spots by slug — a cross-database reference, so no FK. Distinct from the legacy favorite_spots table, which is a saved-locations picker.';
comment on column public.user_favorite_spots.spot_id is
  'BlueCaster fishing_spots.id when known. Repair handle for re-slugged spots; never required.';

-- The list read is always "this user's favourites, newest first" — the shape
-- the dashboard and /favorites both ask for.
create index if not exists idx_user_favorite_spots_user
  on public.user_favorite_spots (user_id, created_at desc);

-- RLS.
--
-- Every write goes through /api/saved-spots holding the service role key, which
-- bypasses RLS entirely — that route is where the free-tier cap is enforced,
-- and the cap is the reason inserts cannot simply be handed to the client.
-- These policies exist because the anon key ships to the browser: they make
-- direct PostgREST access from a signed-in session harmless rather than useful.
--
-- Read-own and delete-own are granted: neither can do damage beyond the user's
-- own list, and un-starring is the one operation with no server-side rule to
-- enforce. Insert is deliberately NOT granted — a client that could insert
-- directly would walk straight past the cap.
alter table public.user_favorite_spots enable row level security;

drop policy if exists "Users read own saved spots" on public.user_favorite_spots;
create policy "Users read own saved spots"
  on public.user_favorite_spots for select
  using (auth.uid() = user_id);

drop policy if exists "Users remove own saved spots" on public.user_favorite_spots;
create policy "Users remove own saved spots"
  on public.user_favorite_spots for delete
  using (auth.uid() = user_id);
