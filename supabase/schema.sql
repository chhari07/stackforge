-- Stack on Supabase: the database, the PDF bucket and their security rules.
-- Run this once: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again after an update.

-- ---- Synced items ----
-- One row per note, saved article, PDF, playlist, focus session, feed or profile.
-- `key` is the item's id (a very long id is shortened by the app; the real id
-- stays in `id`). `seq` is a number the server gives on every write; a device
-- downloads the rows with a higher number than the last one it has seen.
create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  key        text        not null,
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  seq        bigint      not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, key)
);
create sequence if not exists public.items_seq;
create index if not exists items_user_seq on public.items (user_id, seq);

create or replace function public.items_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- One writer per account at a time: a device must never see a higher number
  -- before a lower one is saved, or it would skip the lower one for good.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  new.seq := nextval('public.items_seq');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists items_stamp on public.items;
create trigger items_stamp before insert or update on public.items
  for each row execute function public.items_stamp();

-- Each person reads and writes only their own rows.
alter table public.items enable row level security;
drop policy if exists "own items" on public.items;
create policy "own items" on public.items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;

-- ---- Stack AI: requests per person per day ----
-- Nobody reads or writes this table directly (no policies); only ai_take() does.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  n       int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Counts one request for the signed-in person. False when today's limit is used up.
create or replace function public.ai_take(lim int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me    uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  used  int;
begin
  if me is null or lim < 1 then
    return false;
  end if;
  delete from public.ai_usage where user_id = me and day < today;
  insert into public.ai_usage as u (user_id, day, n)
  values (me, today, 1)
  on conflict (user_id, day) do update set n = u.n + 1 where u.n < lim
  returning u.n into used;
  return used is not null;
end $$;
revoke execute on function public.ai_take(int) from public, anon;
grant execute on function public.ai_take(int) to authenticated;

-- ---- Delete my account ----
-- Removes the login; the person's items and AI counts go with it (on delete
-- cascade). The app removes their PDF files first, through the Storage API.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ---- PDF files ----
-- A private bucket: pdfs/<user id>/<pdf id>.pdf, PDFs only, at most 50 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own pdfs: read" on storage.objects;
create policy "own pdfs: read" on storage.objects for select to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own pdfs: add" on storage.objects;
create policy "own pdfs: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own pdfs: replace" on storage.objects;
create policy "own pdfs: replace" on storage.objects for update to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own pdfs: remove" on storage.objects;
create policy "own pdfs: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ---- Visitor counts (anonymous) ----
-- One row per device per day it opened Stack. `device` is a random id the app
-- makes on first launch: it isn't tied to an account, email, phone or IP, and
-- nothing else about the person is stored. Nobody reads or writes the table
-- directly; the app calls visit() and the owner's dashboard calls visit_stats().
create table if not exists public.visits (
  device    uuid    not null,
  day       date    not null default (now() at time zone 'utc')::date,
  platform  text    not null check (platform in ('android', 'web', 'local')), -- local: testing on localhost
  signed_in boolean not null default false,
  version   text    not null default '' check (length(version) <= 20),
  user_id   uuid    references auth.users (id) on delete set null, -- signed-in visits only
  primary key (device, day)
);
alter table public.visits add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists visits_user_day on public.visits (user_id, day) where user_id is not null;
alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;

-- The app sends the same four values as before; the account comes from the
-- sign-in the request carries (auth.uid()), never from the app itself, so no app
-- update is needed and nobody can claim another person's visits.
create or replace function public.visit(device uuid, platform text, signed_in boolean, version text)
returns void language sql security definer set search_path = '' as $$
  insert into public.visits as v (device, platform, signed_in, version, user_id)
  values (device, platform, signed_in or auth.uid() is not null, left(coalesce(version, ''), 20), auth.uid())
  on conflict (device, day) do update
    set signed_in = v.signed_in or excluded.signed_in,
        version   = excluded.version,
        user_id   = coalesce(excluded.user_id, v.user_id);
$$;
revoke execute on function public.visit(uuid, text, boolean, text) from public;
grant execute on function public.visit(uuid, text, boolean, text) to anon, authenticated;

-- The dashboard's password, stored only as a bcrypt hash. Set it with:
--   insert into public.owner_settings (k, v) values ('stats_pass', extensions.crypt('<password>', extensions.gen_salt('bf')))
--   on conflict (k) do update set v = excluded.v;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.owner_settings (k text primary key, v text not null);
alter table public.owner_settings enable row level security;
revoke all on public.owner_settings from anon, authenticated;

-- Local tests: Stack running on the developer's own computer (localhost)
-- reports platform 'local', kept apart from real Android and website visitors.
-- visits_real is everything except local tests.
alter table public.visits drop constraint if exists visits_platform_check;
alter table public.visits add constraint visits_platform_check check (platform in ('android', 'web', 'local'));
create or replace view public.visits_real with (security_invoker = true) as select * from public.visits where platform <> 'local';
revoke all on public.visits_real from anon, authenticated;

-- Totals only (no device ids, no emails), for the last `days` days (UTC).
-- Null when the password is wrong.
create or replace function public.visit_stats(pass text, days int default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  hash  text;
  today date := (now() at time zone 'utc')::date;
  since date;
begin
  select v into hash from public.owner_settings where k = 'stats_pass';
  if hash is null or pass is null or extensions.crypt(pass, hash) <> hash then
    perform pg_sleep(1); -- slows down guessing
    return null;
  end if;
  since := today - greatest(1, least(coalesce(days, 30), 365)) + 1;
  return jsonb_build_object(
    'today', today,
    'since', since,
    'devices_ever', (select count(distinct device) from public.visits_real),
    'active', jsonb_build_object(
      'today', (select count(*) from public.visits_real where day = today),
      'week',  (select count(distinct device) from public.visits_real where day > today - 7),
      'month', (select count(distinct device) from public.visits_real where day > today - 30),
      'range', (select count(distinct device) from public.visits_real where day >= since)),
    'returning', (select count(*) from (select device from public.visits_real where day >= since
      group by device having count(*) > 1) r),
    'platforms', (select coalesce(jsonb_object_agg(platform, n), '{}') from
      (select platform, count(distinct device) n from public.visits where day >= since group by platform) p),
    'local', jsonb_build_object(
      'today', (select count(*) from public.visits where day = today and platform = 'local'),
      'range', (select count(distinct device) from public.visits where day >= since and platform = 'local')),
    'versions', (select coalesce(jsonb_object_agg(version, n), '{}') from
      (select version, count(distinct device) n from public.visits_real where day >= since group by version) x),
    'daily', (select coalesce(jsonb_agg(d order by d.day), '[]') from (
      select g.day::date as day,
        count(v.device) filter (where not v.signed_in) as guests,
        count(v.device) filter (where v.signed_in) as signed_in,
        count(f.device) as new
      from generate_series(since, today, interval '1 day') g(day)
      left join public.visits_real v on v.day = g.day
      left join (select device, min(day) as first_day from public.visits_real group by device) f
        on f.device = v.device and f.first_day = g.day
      group by g.day) d),
    'accounts', jsonb_build_object(
      'total', (select count(*) from auth.users),
      'new_in_range', (select count(*) from auth.users where created_at >= since),
      'signed_in_week', (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days'),
      'syncing', (select count(distinct user_id) from public.items),
      'daily', (select coalesce(jsonb_agg(a order by a.day), '[]') from (
        select g.day::date as day, count(u.id) as new
        from generate_series(since, today, interval '1 day') g(day)
        left join auth.users u on (u.created_at at time zone 'utc')::date = g.day
        group by g.day) a)),
    'library', (select coalesce(jsonb_object_agg(collection, n), '{}') from
      (select collection, count(*) n from public.items where not deleted group by collection) c),
    'pdf_files', (select jsonb_build_object('count', count(*),
        'bytes', coalesce(sum((metadata->>'size')::bigint), 0))
      from storage.objects where bucket_id = 'pdfs'),
    'ai_today', jsonb_build_object(
      'requests', (select coalesce(sum(n), 0) from public.ai_usage where day = today),
      'people', (select count(*) from public.ai_usage where day = today))
  );
end $$;
revoke execute on function public.visit_stats(text, int) from public;
grant execute on function public.visit_stats(text, int) to anon, authenticated;

-- The Users list, for the dashboard only (null when the password is wrong).
--    Accounts: name, email, how they sign in, when they joined and were last
--    seen, on which platforms, synced items and AI today. Visitors without
--    sign-in: counts per platform, and one anonymous row per device (no names).
create or replace function public.visit_users(pass text, days int default 30)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  hash  text;
  today date := (now() at time zone 'utc')::date;
  since date;
begin
  select v into hash from public.owner_settings where k = 'stats_pass';
  if hash is null or pass is null or extensions.crypt(pass, hash) <> hash then
    perform pg_sleep(1); -- slows down guessing
    return null;
  end if;
  since := today - greatest(1, least(coalesce(days, 30), 365)) + 1;
  return jsonb_build_object(
    'users', (select coalesce(jsonb_agg(u order by u.last_seen desc nulls last, u.joined desc), '[]') from (
      select
        coalesce(nullif(a.raw_user_meta_data->>'full_name', ''), nullif(a.raw_user_meta_data->>'name', ''), split_part(a.email, '@', 1)) as name,
        a.email,
        coalesce(a.raw_app_meta_data->>'provider', 'email') as provider,
        a.created_at as joined,
        a.last_sign_in_at as last_sign_in,
        (select max(v.day) from public.visits v where v.user_id = a.id) as last_seen,
        (select coalesce(jsonb_agg(distinct v.platform), '[]') from public.visits v where v.user_id = a.id) as platforms,
        (select v.platform from public.visits v where v.user_id = a.id order by v.day desc limit 1) as last_platform,
        (select v.version from public.visits v where v.user_id = a.id and v.platform = 'android' order by v.day desc limit 1) as app_version,
        (select count(distinct v.day) from public.visits v where v.user_id = a.id and v.day >= since) as days_active,
        (select count(*) from public.items i where i.user_id = a.id and not i.deleted) as synced,
        coalesce((select n from public.ai_usage x where x.user_id = a.id and x.day = today), 0) as ai_today
      from auth.users a
      where a.deleted_at is null) u),
    'guests', (select coalesce(jsonb_object_agg(platform, n), '{}') from
      (select platform, count(distinct device) n from public.visits
        where day >= since and not signed_in group by platform) g),
    -- Devices that never signed in, one row each: a short code made from the
    -- random device id (not the id itself), app or website, and when.
    'devices', (select coalesce(jsonb_agg(d order by d.last_seen desc), '[]') from (
      select upper(left(md5(device::text), 6)) as code,
        jsonb_agg(distinct platform) as platforms,
        (array_agg(platform order by day desc))[1] as last_platform,
        (array_agg(version order by day desc))[1] as app_version,
        min(day) as first_seen,
        max(day) as last_seen,
        count(*) as days_active
      from public.visits
      where day >= since
      group by device
      having not bool_or(signed_in) and bool_and(user_id is null)
      order by max(day) desc
      limit 1000) d)
  );
end $$;
revoke execute on function public.visit_users(text, int) from public;
grant execute on function public.visit_users(text, int) to anon, authenticated;
