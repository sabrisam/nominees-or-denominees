-- Nominees or Denominees - Supabase multiplayer foundation
-- Run this file in Supabase SQL Editor before starting the PWA.

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
  mood text not null check (mood in ('positive', 'critical', 'fun')),
  sort_order integer not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.nominations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  category_id text not null references public.categories(id),
  image_url text not null,
  image_storage_path text,
  video_url text,
  video_storage_path text,
  title text,
  category text,
  user_device_id text,
  votes_count integer not null default 0 check (votes_count >= 0),
  comment text not null check (char_length(comment) between 3 and 240),
  submitted_by text not null check (char_length(submitted_by) between 8 and 96),
  status public.nomination_status not null default 'pending',
  votes jsonb not null default '{}'::jsonb check (jsonb_typeof(votes) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop table if exists public.trial_rounds;

alter table public.nominations
  add column if not exists title text,
  add column if not exists category text,
  add column if not exists user_device_id text,
  add column if not exists votes_count integer not null default 0;

update public.nominations
set
  title = coalesce(nullif(title, ''), comment),
  category = coalesce(nullif(category, ''), category_id),
  user_device_id = coalesce(nullif(user_device_id, ''), submitted_by),
  votes_count = jsonb_object_length(coalesce(votes, '{}'::jsonb));

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists nominations_room_created_idx on public.nominations(room_id, created_at desc);
create index if not exists nominations_room_status_idx on public.nominations(room_id, status);
create index if not exists nominations_owner_idx on public.nominations(submitted_by);
create index if not exists nominations_user_device_idx on public.nominations(user_device_id);
create index if not exists nominations_video_path_idx on public.nominations(video_storage_path)
  where video_storage_path is not null;

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

update public.categories
set sort_order = sort_order + 1000
where id in (
  'moment_marquant',
  'pepite_cachee',
  'style_remarquable',
  'roue_libre',
  'malaise_public',
  'fou_rire',
  'replique_culte',
  'derapage_leger',
  'choix_discutable',
  'signal_alerte',
  'elan_creatif',
  'silence_genant',
  'performance_surprise',
  'scene_improbable',
  'voyage_express'
);

insert into public.categories (id, label, mood, sort_order) values
  ('moment_marquant', 'Le Zin du mois', 'positive', 1),
  ('pepite_cachee', 'La fierté des nôtres', 'positive', 2),
  ('style_remarquable', 'La honte de la Oumma', 'critical', 3),
  ('roue_libre', 'Roue libre', 'fun', 4),
  ('malaise_public', 'Trop gênant', 'critical', 5),
  ('fou_rire', 'Xptdr', 'fun', 6),
  ('replique_culte', 'Masterclass', 'positive', 7),
  ('derapage_leger', 'Dérape sec', 'critical', 8),
  ('choix_discutable', 'Dossier lourd', 'critical', 9),
  ('signal_alerte', 'Mythomane', 'critical', 10),
  ('elan_creatif', 'Frappe chirurgicale', 'positive', 11),
  ('silence_genant', 'Silence assourdissant', 'critical', 12),
  ('performance_surprise', 'Performance surprise', 'positive', 13)
on conflict (id) do update set
  label = excluded.label,
  mood = excluded.mood,
  sort_order = excluded.sort_order,
  active = true;

update public.categories
set active = false
where id not in (
  'moment_marquant',
  'pepite_cachee',
  'style_remarquable',
  'roue_libre',
  'malaise_public',
  'fou_rire',
  'replique_culte',
  'derapage_leger',
  'choix_discutable',
  'signal_alerte',
  'elan_creatif',
  'silence_genant',
  'performance_surprise'
);

create or replace function public.nod_status_from_votes(next_votes jsonb)
returns public.nomination_status
language sql
immutable
as $$
  with valid_votes as (
    select (entry.value ->> 'rating')::numeric as rating
    from jsonb_each(coalesce(next_votes, '{}'::jsonb)) as entry
    where jsonb_typeof(entry.value) = 'object'
      and entry.value ? 'rating'
      and (entry.value ->> 'rating') ~ '^[0-9]+(\.[0-9]+)?$'
  )
  select case
    when count(*) < 2 then 'pending'::public.nomination_status
    when avg(rating) >= 3 then 'accepted'::public.nomination_status
    else 'rejected'::public.nomination_status
  end
  from valid_votes;
$$;

create or replace function public.submit_nomination_vote(
  target_nomination_id uuid,
  voter_id text,
  vote_payload jsonb
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

  if jsonb_typeof(vote_payload) <> 'object' then
    raise exception 'Vote invalide';
  end if;

  update public.nominations
  set
    votes = jsonb_set(coalesce(votes, '{}'::jsonb), array[voter_id], vote_payload, true),
    status = public.nod_status_from_votes(jsonb_set(coalesce(votes, '{}'::jsonb), array[voter_id], vote_payload, true)),
    votes_count = jsonb_object_length(jsonb_set(coalesce(votes, '{}'::jsonb), array[voter_id], vote_payload, true))
  where id = target_nomination_id
  returning * into updated_nomination;

  if updated_nomination.id is null then
    raise exception 'Dossier introuvable';
  end if;

  return updated_nomination;
end;
$$;

grant execute on function public.submit_nomination_vote(uuid, text, jsonb) to anon;

create or replace function public.update_own_nomination(
  target_nomination_id uuid,
  editor_id text,
  next_comment text,
  next_category_id text
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
  if char_length(next_comment) < 3 or char_length(next_comment) > 240 then
    raise exception 'Note invalide';
  end if;

  if not exists (select 1 from public.categories where id = next_category_id and active = true) then
    raise exception 'Catégorie invalide';
  end if;

  update public.nominations
  set
    comment = next_comment,
    title = next_comment,
    category_id = next_category_id,
    category = next_category_id
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

grant execute on function public.update_own_nomination(uuid, text, text, text) to anon;
grant execute on function public.delete_own_nomination(uuid, text) to anon;

alter table public.rooms enable row level security;
alter table public.categories enable row level security;
alter table public.nominations enable row level security;

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

drop policy if exists "NOD nominations write" on public.nominations;
drop policy if exists "NOD nominations insert" on public.nominations;
create policy "NOD nominations insert" on public.nominations
for insert to anon with check (true);

drop policy if exists "NOD nominations update" on public.nominations;
drop policy if exists "NOD nominations delete" on public.nominations;
