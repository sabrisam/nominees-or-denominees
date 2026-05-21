-- Nominees or Denominees - tournoi multijoueur relationnel
-- Run this file in Supabase SQL Editor before starting the PWA.

create extension if not exists pgcrypto;

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

create table if not exists public.tiktokeurs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 48),
  avatar_emoji text not null default '🎥' check (char_length(avatar_emoji) between 1 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dossiers (
  id uuid primary key default gen_random_uuid(),
  submitted_by text not null check (char_length(submitted_by) between 8 and 96),
  tiktokeur_id uuid not null references public.tiktokeurs(id) on delete restrict,
  category_id text not null references public.categories(id),
  media_url text not null,
  media_storage_path text,
  thumbnail_url text,
  thumbnail_storage_path text,
  media_kind text not null default 'image' check (media_kind in ('video', 'image')),
  comment text not null check (char_length(comment) between 3 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  dossier_id uuid not null references public.dossiers(id) on delete cascade,
  voter_id text not null check (char_length(voter_id) between 8 and 96),
  stars_count integer not null check (stars_count between 1 and 5),
  comment text not null check (char_length(comment) between 2 and 180),
  voted_at timestamptz not null default now(),
  unique (dossier_id, voter_id)
);

drop table if exists public.trial_rounds;

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists categories_active_sort_idx on public.categories(active, sort_order);
create index if not exists tiktokeurs_name_idx on public.tiktokeurs(name);
create index if not exists dossiers_created_idx on public.dossiers(created_at desc);
create index if not exists dossiers_owner_idx on public.dossiers(submitted_by);
create index if not exists dossiers_tiktokeur_idx on public.dossiers(tiktokeur_id);
create index if not exists dossiers_category_idx on public.dossiers(category_id);
create index if not exists ratings_dossier_idx on public.ratings(dossier_id, voted_at desc);
create index if not exists ratings_voter_idx on public.ratings(voter_id);

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

drop trigger if exists tiktokeurs_set_updated_at on public.tiktokeurs;
create trigger tiktokeurs_set_updated_at
before update on public.tiktokeurs
for each row execute function public.set_updated_at();

drop trigger if exists dossiers_set_updated_at on public.dossiers;
create trigger dossiers_set_updated_at
before update on public.dossiers
for each row execute function public.set_updated_at();

update public.categories
set sort_order = sort_order + 1000
where id not in (
  'zin_du_mois',
  'fierte_des_notres',
  'honte_oumma',
  'roue_libre',
  'trop_genant',
  'xptdr',
  'masterclass',
  'derape_sec',
  'dossier_lourd',
  'mythomane',
  'frappe_chirurgicale',
  'silence_assourdissant',
  'performance_surprise'
);

insert into public.categories (id, label, mood, sort_order) values
  ('zin_du_mois', 'Le Zin du mois', 'positive', 1),
  ('fierte_des_notres', 'La fierté des nôtres', 'positive', 2),
  ('honte_oumma', 'La honte de la Oumma', 'critical', 3),
  ('roue_libre', 'Roue libre', 'fun', 4),
  ('trop_genant', 'Trop gênant', 'critical', 5),
  ('xptdr', 'Xptdr', 'fun', 6),
  ('masterclass', 'Masterclass', 'positive', 7),
  ('derape_sec', 'Dérape sec', 'critical', 8),
  ('dossier_lourd', 'Dossier lourd', 'critical', 9),
  ('mythomane', 'Mythomane', 'critical', 10),
  ('frappe_chirurgicale', 'Frappe chirurgicale', 'positive', 11),
  ('silence_assourdissant', 'Silence assourdissant', 'critical', 12),
  ('performance_surprise', 'Performance surprise', 'positive', 13)
on conflict (id) do update set
  label = excluded.label,
  mood = excluded.mood,
  sort_order = excluded.sort_order,
  active = true;

update public.categories
set active = false
where id not in (
  'zin_du_mois',
  'fierte_des_notres',
  'honte_oumma',
  'roue_libre',
  'trop_genant',
  'xptdr',
  'masterclass',
  'derape_sec',
  'dossier_lourd',
  'mythomane',
  'frappe_chirurgicale',
  'silence_assourdissant',
  'performance_surprise'
);

create or replace function public.submit_dossier_rating(
  target_dossier_id uuid,
  voter_id text,
  stars integer,
  reaction_comment text
)
returns public.ratings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_rating public.ratings;
begin
  if voter_id is null or char_length(voter_id) < 8 or char_length(voter_id) > 96 then
    raise exception 'Identifiant de votant invalide';
  end if;

  if not exists (select 1 from public.dossiers where id = target_dossier_id) then
    raise exception 'Dossier introuvable';
  end if;

  if stars < 1 or stars > 5 then
    raise exception 'Note invalide';
  end if;

  reaction_comment := btrim(coalesce(reaction_comment, ''));
  if char_length(reaction_comment) < 2 or char_length(reaction_comment) > 180 then
    raise exception 'Réaction invalide';
  end if;

  insert into public.ratings (dossier_id, voter_id, stars_count, comment)
  values (target_dossier_id, voter_id, stars, reaction_comment)
  on conflict (dossier_id, voter_id) do update set
    stars_count = excluded.stars_count,
    comment = excluded.comment,
    voted_at = now()
  returning * into updated_rating;

  return updated_rating;
end;
$$;

create or replace function public.update_own_dossier(
  target_dossier_id uuid,
  editor_id text,
  next_comment text,
  next_category_id text,
  next_tiktokeur_id uuid
)
returns public.dossiers
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_dossier public.dossiers;
begin
  if editor_id is null or char_length(editor_id) < 8 or char_length(editor_id) > 96 then
    raise exception 'Identifiant propriétaire invalide';
  end if;

  next_comment := btrim(coalesce(next_comment, ''));
  if char_length(next_comment) < 3 or char_length(next_comment) > 240 then
    raise exception 'Contexte invalide';
  end if;

  if not exists (select 1 from public.categories where id = next_category_id and active = true) then
    raise exception 'Catégorie invalide';
  end if;

  if not exists (select 1 from public.tiktokeurs where id = next_tiktokeur_id) then
    raise exception 'Profil TikTok introuvable';
  end if;

  update public.dossiers
  set
    comment = next_comment,
    category_id = next_category_id,
    tiktokeur_id = next_tiktokeur_id
  where id = target_dossier_id
    and submitted_by = editor_id
  returning * into updated_dossier;

  if updated_dossier.id is null then
    raise exception 'Modification verrouillée';
  end if;

  return updated_dossier;
end;
$$;

create or replace function public.delete_own_dossier(
  target_dossier_id uuid,
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

  delete from public.dossiers
  where id = target_dossier_id
    and submitted_by = editor_id
  returning id into deleted_id;

  if deleted_id is null then
    raise exception 'Retrait verrouillé';
  end if;

  return true;
end;
$$;

grant execute on function public.submit_dossier_rating(uuid, text, integer, text) to anon;
grant execute on function public.update_own_dossier(uuid, text, text, text, uuid) to anon;
grant execute on function public.delete_own_dossier(uuid, text) to anon;

alter table public.rooms enable row level security;
alter table public.categories enable row level security;
alter table public.tiktokeurs enable row level security;
alter table public.dossiers enable row level security;
alter table public.ratings enable row level security;

drop policy if exists "NOD rooms read" on public.rooms;
create policy "NOD rooms read" on public.rooms
for select to anon using (true);

drop policy if exists "NOD rooms write" on public.rooms;
create policy "NOD rooms write" on public.rooms
for all to anon using (true) with check (true);

drop policy if exists "NOD categories read" on public.categories;
create policy "NOD categories read" on public.categories
for select to anon using (active = true);

drop policy if exists "NOD tiktokeurs read" on public.tiktokeurs;
create policy "NOD tiktokeurs read" on public.tiktokeurs
for select to anon using (true);

drop policy if exists "NOD tiktokeurs write" on public.tiktokeurs;
create policy "NOD tiktokeurs write" on public.tiktokeurs
for insert to anon with check (true);

drop policy if exists "NOD tiktokeurs update avatar" on public.tiktokeurs;
create policy "NOD tiktokeurs update avatar" on public.tiktokeurs
for update to anon using (true) with check (true);

drop policy if exists "NOD dossiers read" on public.dossiers;
create policy "NOD dossiers read" on public.dossiers
for select to anon using (true);

drop policy if exists "NOD dossiers insert" on public.dossiers;
create policy "NOD dossiers insert" on public.dossiers
for insert to anon with check (true);

drop policy if exists "NOD dossiers update" on public.dossiers;
drop policy if exists "NOD dossiers delete" on public.dossiers;

drop policy if exists "NOD ratings read" on public.ratings;
create policy "NOD ratings read" on public.ratings
for select to anon using (true);

drop policy if exists "NOD ratings insert" on public.ratings;
drop policy if exists "NOD ratings update" on public.ratings;
drop policy if exists "NOD ratings delete" on public.ratings;
