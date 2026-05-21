-- NOD: Nominees or Denominees - schema V2 tournoi mensuel
-- Exécuter dans Supabase SQL Editor.

create extension if not exists pgcrypto;

do $$ begin
  create type public.nomination_status as enum ('pending', 'accepted', 'rejected');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 3 and 24),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id text primary key,
  label text not null,
  mood text not null check (mood in ('positive', 'critical', 'fun', 'surprise')),
  sort_order integer not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.categories drop constraint if exists categories_mood_check;
alter table public.categories
  add constraint categories_mood_check
  check (mood in ('positive', 'critical', 'fun', 'surprise'));

create table if not exists public.nominations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category_id text not null references public.categories(id),
  tiktoker_name text not null check (char_length(tiktoker_name) between 2 and 48),
  media_url text not null,
  video_storage_path text,
  thumbnail_url text,
  thumbnail_storage_path text,
  media_kind text not null default 'image' check (media_kind in ('video', 'image')),
  comment text not null check (char_length(comment) between 3 and 240),
  submitted_by text not null check (char_length(submitted_by) between 8 and 96),
  status public.nomination_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid references public.nominations(id) on delete cascade,
  voter_id text not null check (char_length(voter_id) between 8 and 96),
  rating_stars integer check (rating_stars between 1 and 5),
  comment text not null check (char_length(comment) between 2 and 180),
  created_at timestamptz not null default now(),
  unique (nomination_id, voter_id)
);

create table if not exists public.monthly_ceremonies (
  season_month date primary key,
  payload jsonb not null,
  frozen_at timestamptz not null default now()
);

-- Compatibilité douce avec les anciens essais de schéma.
alter table public.nominations add column if not exists room_id uuid references public.rooms(id) on delete cascade;
alter table public.nominations add column if not exists category_id text references public.categories(id);
alter table public.nominations add column if not exists tiktoker_name text;
alter table public.nominations add column if not exists media_url text;
alter table public.nominations add column if not exists video_storage_path text;
alter table public.nominations add column if not exists thumbnail_url text;
alter table public.nominations add column if not exists thumbnail_storage_path text;
alter table public.nominations add column if not exists media_kind text not null default 'image';
alter table public.nominations add column if not exists comment text;
alter table public.nominations add column if not exists submitted_by text;
alter table public.nominations add column if not exists status public.nomination_status not null default 'pending';
alter table public.nominations add column if not exists updated_at timestamptz not null default now();

alter table public.nominations drop constraint if exists nominations_media_kind_check;
alter table public.nominations
  add constraint nominations_media_kind_check
  check (media_kind in ('video', 'image'));

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nominations' and column_name = 'image_url') then
    alter table public.nominations alter column image_url drop not null;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nominations' and column_name = 'video_url') then
    execute 'update public.nominations set media_url = coalesce(media_url, video_url, image_url) where media_url is null';
  elsif exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'nominations' and column_name = 'image_url') then
    execute 'update public.nominations set media_url = coalesce(media_url, image_url) where media_url is null';
  end if;
end $$;

alter table public.ratings add column if not exists nomination_id uuid references public.nominations(id) on delete cascade;
alter table public.ratings add column if not exists rating_stars integer check (rating_stars between 1 and 5);
alter table public.ratings add column if not exists created_at timestamptz not null default now();

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ratings' and column_name = 'dossier_id') then
    alter table public.ratings alter column dossier_id drop not null;
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ratings' and column_name = 'stars_count') then
    alter table public.ratings alter column stars_count drop not null;
    execute 'update public.ratings set rating_stars = coalesce(rating_stars, stars_count) where rating_stars is null';
  end if;

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'ratings' and column_name = 'voted_at') then
    execute 'update public.ratings set created_at = coalesce(created_at, voted_at) where created_at is null';
  end if;
end $$;

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists categories_active_sort_idx on public.categories(active, sort_order);
create index if not exists nominations_room_created_idx on public.nominations(room_id, created_at desc);
create index if not exists nominations_room_status_idx on public.nominations(room_id, status);
create index if not exists nominations_owner_idx on public.nominations(submitted_by);
create index if not exists nominations_tiktoker_idx on public.nominations(tiktoker_name);
create index if not exists nominations_category_idx on public.nominations(category_id);
create index if not exists ratings_nomination_created_idx on public.ratings(nomination_id, created_at desc);
create index if not exists ratings_voter_idx on public.ratings(voter_id);

drop index if exists public.ratings_nomination_voter_idx;
create unique index ratings_nomination_voter_idx
on public.ratings(nomination_id, voter_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row execute function public.set_updated_at();

drop trigger if exists nominations_set_updated_at on public.nominations;
create trigger nominations_set_updated_at
before update on public.nominations
for each row execute function public.set_updated_at();

with archived_categories as (
  select
    id,
    1000 + row_number() over (order by sort_order, id) as archived_sort_order
  from public.categories
)
update public.categories as category
set
  sort_order = archived_categories.archived_sort_order,
  active = false
from archived_categories
where category.id = archived_categories.id;

insert into public.categories (id, label, mood, sort_order) values
  ('le_zin_du_mois', 'Le Zin du mois', 'positive', 1),
  ('fierte_des_notres', 'La Fierté des Nôtres', 'positive', 2),
  ('xptdr', 'Xptdr', 'fun', 3),
  ('honte_absolue', 'Honte Absolue', 'critical', 4)
on conflict (id) do update set
  label = excluded.label,
  mood = excluded.mood,
  sort_order = excluded.sort_order,
  active = true;

update public.categories
set active = false
where id not in (
  'le_zin_du_mois',
  'fierte_des_notres',
  'xptdr',
  'honte_absolue'
);

create or replace function public.recalculate_nomination_status(target_nomination_id uuid)
returns public.nomination_status
language plpgsql
security definer
set search_path = public
as $$
declare
  vote_count integer;
  average_score numeric;
  next_status public.nomination_status;
begin
  select count(*), avg(rating_stars)::numeric
  into vote_count, average_score
  from public.ratings
  where nomination_id = target_nomination_id
    and rating_stars between 1 and 5;

  if coalesce(vote_count, 0) < 2 then
    next_status := 'pending';
  elsif coalesce(average_score, 0) >= 3 then
    next_status := 'accepted';
  else
    next_status := 'rejected';
  end if;

  update public.nominations
  set status = next_status
  where id = target_nomination_id;

  return next_status;
end;
$$;

create or replace function public.submit_nomination_vote(
  target_nomination_id uuid,
  voter_id text,
  stars integer,
  reaction_comment text
)
returns public.nominations
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_nomination public.nominations;
begin
  if voter_id is null or char_length(voter_id) < 8 or char_length(voter_id) > 96 then
    raise exception 'Identifiant de votant invalide';
  end if;

  if not exists (select 1 from public.nominations where id = target_nomination_id) then
    raise exception 'Dossier introuvable';
  end if;

  if stars < 1 or stars > 5 then
    raise exception 'Note invalide';
  end if;

  reaction_comment := btrim(coalesce(reaction_comment, ''));
  if char_length(reaction_comment) < 2 or char_length(reaction_comment) > 180 then
    raise exception 'Réaction invalide';
  end if;

  insert into public.ratings (nomination_id, voter_id, rating_stars, comment)
  values (target_nomination_id, voter_id, stars, reaction_comment)
  on conflict (nomination_id, voter_id) do update set
    rating_stars = excluded.rating_stars,
    comment = excluded.comment,
    created_at = now();

  perform public.recalculate_nomination_status(target_nomination_id);

  select *
  into updated_nomination
  from public.nominations
  where id = target_nomination_id;

  return updated_nomination;
end;
$$;

create or replace function public.update_own_nomination(
  target_nomination_id uuid,
  editor_id text,
  next_comment text,
  next_category_id text,
  next_tiktoker_name text
)
returns public.nominations
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_nomination public.nominations;
begin
  if editor_id is null or char_length(editor_id) < 8 or char_length(editor_id) > 96 then
    raise exception 'Identifiant propriétaire invalide';
  end if;

  next_comment := btrim(coalesce(next_comment, ''));
  next_tiktoker_name := btrim(coalesce(next_tiktoker_name, ''));

  if char_length(next_comment) < 3 or char_length(next_comment) > 240 then
    raise exception 'Contexte invalide';
  end if;

  if char_length(next_tiktoker_name) < 2 or char_length(next_tiktoker_name) > 48 then
    raise exception 'TikToker invalide';
  end if;

  if not exists (select 1 from public.categories where id = next_category_id and active = true) then
    raise exception 'Catégorie invalide';
  end if;

  update public.nominations
  set
    comment = next_comment,
    category_id = next_category_id,
    tiktoker_name = next_tiktoker_name
  where id = target_nomination_id
    and submitted_by = editor_id
  returning * into updated_nomination;

  if updated_nomination.id is null then
    raise exception 'Modification verrouillée';
  end if;

  return updated_nomination;
end;
$$;

create or replace function public.delete_own_nomination(
  target_nomination_id uuid,
  editor_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  deleted_id uuid;
begin
  if editor_id is null or char_length(editor_id) < 8 or char_length(editor_id) > 96 then
    raise exception 'Identifiant propriétaire invalide';
  end if;

  delete from public.nominations
  where id = target_nomination_id
    and submitted_by = editor_id
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Retrait verrouillé';
  end if;

  return true;
end;
$$;

create or replace function public.build_monthly_ceremony(
  season_month date default date_trunc('month', current_date - interval '1 month')::date
)
returns jsonb
language sql
stable
as $$
  with accepted_nomination_scores as (
    select
      n.id,
      n.category_id,
      n.tiktoker_name,
      n.submitted_by,
      sum(r.rating_stars)::integer as points,
      avg(r.rating_stars)::numeric as average_rating
    from public.nominations n
    join public.ratings r on r.nomination_id = n.id
    where n.status = 'accepted'
      and n.created_at >= season_month
      and n.created_at < (season_month + interval '1 month')
    group by n.id, n.category_id, n.tiktoker_name, n.submitted_by
  ),
  category_scores as (
    select
      category_id,
      tiktoker_name,
      sum(points)::integer as points,
      row_number() over (partition by category_id order by sum(points) desc, tiktoker_name asc) as rank
    from accepted_nomination_scores
    group by category_id, tiktoker_name
  ),
  global_scores as (
    select
      tiktoker_name,
      sum(points)::integer as points,
      row_number() over (order by sum(points) desc, tiktoker_name asc) as rank
    from accepted_nomination_scores
    group by tiktoker_name
  ),
  paparazzi_scores as (
    select
      submitted_by,
      id as nomination_id,
      points,
      row_number() over (order by points desc, average_rating desc, id asc) as rank
    from accepted_nomination_scores
  )
  select jsonb_build_object(
    'season_month', season_month,
    'category_winners', coalesce((
      select jsonb_agg(jsonb_build_object('category_id', category_id, 'tiktoker_name', tiktoker_name, 'points', points) order by category_id)
      from category_scores
      where rank = 1
    ), '[]'::jsonb),
    'ultimate_tiktoker', (
      select jsonb_build_object('tiktoker_name', tiktoker_name, 'points', points)
      from global_scores
      where rank = 1
    ),
    'paparazzi_or', (
      select jsonb_build_object('submitted_by', submitted_by, 'nomination_id', nomination_id, 'points', points)
      from paparazzi_scores
      where rank = 1
    )
  );
$$;

create or replace function public.freeze_monthly_ceremony(
  season_month date default date_trunc('month', current_date - interval '1 month')::date
)
returns public.monthly_ceremonies
language plpgsql
security definer
set search_path = public
as $$
declare
  frozen public.monthly_ceremonies;
begin
  insert into public.monthly_ceremonies (season_month, payload)
  values (season_month, public.build_monthly_ceremony(season_month))
  on conflict (season_month) do update set
    payload = excluded.payload,
    frozen_at = now()
  returning * into frozen;

  return frozen;
end;
$$;

grant execute on function public.submit_nomination_vote(uuid, text, integer, text) to anon;
grant execute on function public.update_own_nomination(uuid, text, text, text, text) to anon;
grant execute on function public.delete_own_nomination(uuid, text) to anon;
grant execute on function public.build_monthly_ceremony(date) to anon;
grant execute on function public.freeze_monthly_ceremony(date) to anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('nod-media', 'nod-media', true, null, null)
on conflict (id) do update set
  public = true,
  file_size_limit = null,
  allowed_mime_types = null;

alter table public.rooms enable row level security;
alter table public.categories enable row level security;
alter table public.nominations enable row level security;
alter table public.ratings enable row level security;
alter table public.monthly_ceremonies enable row level security;

drop policy if exists "NOD rooms read" on public.rooms;
create policy "NOD rooms read" on public.rooms
for select to anon using (true);

drop policy if exists "NOD rooms write" on public.rooms;
create policy "NOD rooms write" on public.rooms
for all to anon using (true) with check (true);

drop policy if exists "NOD categories read" on public.categories;
create policy "NOD categories read" on public.categories
for select to anon using (active = true);

drop policy if exists "NOD nominations read" on public.nominations;
create policy "NOD nominations read" on public.nominations
for select to anon using (true);

drop policy if exists "NOD nominations insert" on public.nominations;
create policy "NOD nominations insert" on public.nominations
for insert to anon with check (true);

drop policy if exists "NOD nominations update" on public.nominations;
drop policy if exists "NOD nominations delete" on public.nominations;

drop policy if exists "NOD ratings read" on public.ratings;
create policy "NOD ratings read" on public.ratings
for select to anon using (true);

drop policy if exists "NOD ratings insert" on public.ratings;
drop policy if exists "NOD ratings update" on public.ratings;
drop policy if exists "NOD ratings delete" on public.ratings;

drop policy if exists "NOD ceremonies read" on public.monthly_ceremonies;
create policy "NOD ceremonies read" on public.monthly_ceremonies
for select to anon using (true);

drop policy if exists "NOD media public read" on storage.objects;
create policy "NOD media public read" on storage.objects
for select to anon using (bucket_id = 'nod-media');

drop policy if exists "NOD media upload" on storage.objects;
create policy "NOD media upload" on storage.objects
for insert to anon with check (
  bucket_id = 'nod-media'
  and (storage.foldername(name))[1] in ('videos', 'miniatures')
);

drop policy if exists "NOD media update" on storage.objects;
create policy "NOD media update" on storage.objects
for update to anon using (bucket_id = 'nod-media') with check (bucket_id = 'nod-media');

drop policy if exists "NOD media delete" on storage.objects;
create policy "NOD media delete" on storage.objects
for delete to anon using (bucket_id = 'nod-media');

do $$ begin
  alter publication supabase_realtime add table public.nominations;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$ begin
  alter publication supabase_realtime add table public.ratings;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
