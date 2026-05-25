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
  category_ids text[] not null default '{}'::text[],
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
  rating_stars integer check (rating_stars between 0 and 5),
  rating_score numeric(4,2) not null default 0 check (rating_score between 0 and 5),
  rating_points integer not null default 0 check (rating_points between 0 and 100),
  rire_score integer not null default 0 check (rire_score between 0 and 5),
  surprise_score integer not null default 0 check (surprise_score between 0 and 5),
  gene_score integer not null default 0 check (gene_score between 0 and 5),
  fierte_score integer not null default 0 check (fierte_score between 0 and 5),
  interet_score integer not null default 0 check (interet_score between 0 and 5),
  comment text not null default '' check (char_length(comment) between 0 and 180),
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
alter table public.nominations add column if not exists category_ids text[] not null default '{}'::text[];
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
alter table public.ratings drop constraint if exists ratings_rating_stars_check;
alter table public.ratings add column if not exists rating_stars integer;
alter table public.ratings add constraint ratings_rating_stars_check check (rating_stars between 0 and 5);
alter table public.ratings add column if not exists rating_score numeric(4,2) not null default 0;
alter table public.ratings add column if not exists rating_points integer not null default 0;
alter table public.ratings add column if not exists rire_score integer not null default 0;
alter table public.ratings add column if not exists surprise_score integer not null default 0;
alter table public.ratings add column if not exists gene_score integer not null default 0;
alter table public.ratings add column if not exists fierte_score integer not null default 0;
alter table public.ratings add column if not exists interet_score integer not null default 0;
alter table public.ratings add column if not exists created_at timestamptz not null default now();

alter table public.ratings drop constraint if exists ratings_comment_check;
alter table public.ratings add constraint ratings_comment_check check (char_length(comment) between 0 and 180);
alter table public.ratings drop constraint if exists ratings_rating_score_check;
alter table public.ratings add constraint ratings_rating_score_check check (rating_score between 0 and 5);
alter table public.ratings drop constraint if exists ratings_rating_points_check;
alter table public.ratings add constraint ratings_rating_points_check check (rating_points between 0 and 100);
alter table public.ratings drop constraint if exists ratings_rire_score_check;
alter table public.ratings add constraint ratings_rire_score_check check (rire_score between 0 and 5);
alter table public.ratings drop constraint if exists ratings_surprise_score_check;
alter table public.ratings add constraint ratings_surprise_score_check check (surprise_score between 0 and 5);
alter table public.ratings drop constraint if exists ratings_gene_score_check;
alter table public.ratings add constraint ratings_gene_score_check check (gene_score between 0 and 5);
alter table public.ratings drop constraint if exists ratings_fierte_score_check;
alter table public.ratings add constraint ratings_fierte_score_check check (fierte_score between 0 and 5);
alter table public.ratings drop constraint if exists ratings_interet_score_check;
alter table public.ratings add constraint ratings_interet_score_check check (interet_score between 0 and 5);

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

update public.nominations
set category_ids = array[coalesce(category_id, 'le-zin-du-mois')]
where category_ids is null or cardinality(category_ids) = 0;

update public.ratings
set
  rating_stars = coalesce(rating_stars, 0),
  rire_score = case when rire_score = 0 and coalesce(rating_stars, 0) > 0 then rating_stars else rire_score end,
  surprise_score = case when surprise_score = 0 and coalesce(rating_stars, 0) > 0 then rating_stars else surprise_score end,
  gene_score = case when gene_score = 0 and coalesce(rating_stars, 0) > 0 then rating_stars else gene_score end,
  fierte_score = case when fierte_score = 0 and coalesce(rating_stars, 0) > 0 then rating_stars else fierte_score end,
  interet_score = case when interet_score = 0 and coalesce(rating_stars, 0) > 0 then rating_stars else interet_score end;

create or replace function public.compute_rating_points_for_category(
  target_category_id text,
  rire integer,
  surprise integer,
  gene integer,
  fierte integer,
  interet integer
)
returns integer
language plpgsql
immutable
as $$
declare
  r numeric := least(5, greatest(0, coalesce(rire, 0)));
  s numeric := least(5, greatest(0, coalesce(surprise, 0)));
  g numeric := least(5, greatest(0, coalesce(gene, 0)));
  f numeric := least(5, greatest(0, coalesce(fierte, 0)));
  i numeric := least(5, greatest(0, coalesce(interet, 0)));
  weighted numeric;
begin
  weighted := case coalesce(target_category_id, 'le-zin-du-mois')
    when 'le-zin-du-mois' then (r * 0.18) + (s * 0.18) + ((5 - g) * 0.12) + (f * 0.32) + (i * 0.20)
    when 'la-fierte-des-notres' then (r * 0.10) + (s * 0.14) + ((5 - g) * 0.22) + (f * 0.34) + (i * 0.20)
    when 'xptdr' then (r * 0.46) + (s * 0.20) + ((5 - g) * 0.18) + (f * 0.04) + (i * 0.12)
    when 'la-roue-libre' then (r * 0.30) + (s * 0.34) + (g * 0.14) + (f * 0.04) + (i * 0.18)
    when 'la-honte-de-la-oumma' then (r * 0.07) + (s * 0.10) + (g * 0.55) + ((5 - f) * 0.25) + (i * 0.03)
    when 'bon-voyageur' then (r * 0.12) + (s * 0.28) + ((5 - g) * 0.10) + (f * 0.14) + (i * 0.36)
    when 'gros-chef-bandit' then (r * 0.24) + (s * 0.18) + ((5 - g) * 0.16) + (f * 0.24) + (i * 0.18)
    when 'surprise-totale' then (r * 0.14) + (s * 0.46) + ((5 - g) * 0.08) + (f * 0.10) + (i * 0.22)
    when 'lanalyse-pure' then (r * 0.04) + (s * 0.12) + ((5 - g) * 0.18) + (f * 0.22) + (i * 0.44)
    else (r + s + g + f + i) / 5
  end;

  return least(100, greatest(0, round(weighted * 20)::integer));
end;
$$;

with computed as (
  select
    r.id,
    public.compute_rating_points_for_category(n.category_id, r.rire_score, r.surprise_score, r.gene_score, r.fierte_score, r.interet_score) as points
  from public.ratings r
  join public.nominations n on n.id = r.nomination_id
)
update public.ratings as rating
set
  rating_points = computed.points,
  rating_score = round((computed.points::numeric / 20), 2),
  rating_stars = round((computed.points::numeric / 20))::integer
from computed
where rating.id = computed.id;

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

with safe_category_shift as (
  select
    id,
    (select coalesce(min(sort_order), 0) from public.categories) - 1000000 - row_number() over (order by sort_order, id) as safe_sort_order
  from public.categories
)
update public.categories as category
set
  sort_order = safe_category_shift.safe_sort_order,
  active = false
from safe_category_shift
where category.id = safe_category_shift.id;

insert into public.categories (id, label, mood, sort_order) values
  ('le-zin-du-mois', 'Le Zin du Mois', 'positive', 1),
  ('la-fierte-des-notres', 'La Fierté des Nôtres', 'positive', 2),
  ('xptdr', 'Xptdr', 'fun', 3),
  ('la-roue-libre', 'La Roue Libre', 'fun', 4),
  ('la-honte-de-la-oumma', 'La Honte de la Oumma', 'critical', 5),
  ('bon-voyageur', 'Bon Voyageur', 'surprise', 6),
  ('gros-chef-bandit', 'Gros Chef Bandit', 'fun', 7),
  ('surprise-totale', 'Surprise Totale', 'surprise', 8),
  ('lanalyse-pure', 'L’Analyse Pure', 'positive', 9)
on conflict (id) do update set
  label = excluded.label,
  mood = excluded.mood,
  sort_order = excluded.sort_order,
  active = true;

update public.nominations
set category_id = case category_id
  when 'le_zin_du_mois' then 'le-zin-du-mois'
  when 'fierte_des_notres' then 'la-fierte-des-notres'
  when 'roue_libre' then 'la-roue-libre'
  when 'honte_de_la_oumma' then 'la-honte-de-la-oumma'
  when 'bon_voyageur' then 'bon-voyageur'
  when 'gros_chef_bandit' then 'gros-chef-bandit'
  when 'surprise_totale' then 'surprise-totale'
  when 'analyse_pure' then 'lanalyse-pure'
  when 'honte_absolue' then 'la-honte-de-la-oumma'
  when 'fierte' then 'la-fierte-des-notres'
  when 'pepite_cachee' then 'le-zin-du-mois'
  when 'roue' then 'la-roue-libre'
  when 'viral' then 'surprise-totale'
  else category_id
end
where category_id in ('le_zin_du_mois', 'fierte_des_notres', 'roue_libre', 'honte_de_la_oumma', 'bon_voyageur', 'gros_chef_bandit', 'surprise_totale', 'analyse_pure', 'honte_absolue', 'fierte', 'pepite_cachee', 'roue', 'viral');

update public.nominations
set category_ids = (
  select array_agg(distinct case category_list.category_id
    when 'le_zin_du_mois' then 'le-zin-du-mois'
    when 'fierte_des_notres' then 'la-fierte-des-notres'
    when 'roue_libre' then 'la-roue-libre'
    when 'honte_de_la_oumma' then 'la-honte-de-la-oumma'
    when 'bon_voyageur' then 'bon-voyageur'
    when 'gros_chef_bandit' then 'gros-chef-bandit'
    when 'surprise_totale' then 'surprise-totale'
    when 'analyse_pure' then 'lanalyse-pure'
    when 'honte_absolue' then 'la-honte-de-la-oumma'
    when 'fierte' then 'la-fierte-des-notres'
    when 'pepite_cachee' then 'le-zin-du-mois'
    when 'roue' then 'la-roue-libre'
    when 'viral' then 'surprise-totale'
    else category_list.category_id
  end)
  from unnest(category_ids) as category_list(category_id)
)
where category_ids is not null;

update public.nominations
set category_ids = array[coalesce(category_id, 'le-zin-du-mois')]
where category_ids is null or cardinality(category_ids) = 0;

create or replace function public.recalculate_nomination_status(target_nomination_id uuid)
returns public.nomination_status
language plpgsql
security definer
set search_path = public
as $$
declare
  vote_count integer;
  next_status public.nomination_status;
begin
  select count(*)
  into vote_count
  from public.ratings
  where nomination_id = target_nomination_id;

  if coalesce(vote_count, 0) < 2 then
    next_status := 'pending';
  else
    next_status := 'accepted';
  end if;

  update public.nominations
  set status = next_status
  where id = target_nomination_id;

  return next_status;
end;
$$;

create or replace function public.recalculate_nomination_status_from_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.recalculate_nomination_status(coalesce(new.nomination_id, old.nomination_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists ratings_recalculate_nomination_status on public.ratings;
create trigger ratings_recalculate_nomination_status
after insert or update or delete on public.ratings
for each row execute function public.recalculate_nomination_status_from_rating();

with vote_counts as (
  select
    n.id,
    count(r.id) as vote_count
  from public.nominations n
  left join public.ratings r on r.nomination_id = n.id
  group by n.id
)
update public.nominations as nomination
set status = case when vote_counts.vote_count >= 2 then 'accepted'::public.nomination_status else 'pending'::public.nomination_status end
from vote_counts
where nomination.id = vote_counts.id;

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

  if stars < 0 or stars > 5 then
    raise exception 'Note invalide';
  end if;

  reaction_comment := left(btrim(coalesce(reaction_comment, '')), 180);

  insert into public.ratings (
    nomination_id,
    voter_id,
    rating_stars,
    rating_score,
    rating_points,
    rire_score,
    surprise_score,
    gene_score,
    fierte_score,
    interet_score,
    comment
  )
  values (
    target_nomination_id,
    voter_id,
    stars,
    stars,
    stars * 20,
    stars,
    stars,
    stars,
    stars,
    stars,
    reaction_comment
  )
  on conflict (nomination_id, voter_id) do update set
    rating_stars = excluded.rating_stars,
    rating_score = excluded.rating_score,
    rating_points = excluded.rating_points,
    rire_score = excluded.rire_score,
    surprise_score = excluded.surprise_score,
    gene_score = excluded.gene_score,
    fierte_score = excluded.fierte_score,
    interet_score = excluded.interet_score,
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

create or replace function public.submit_nomination_vote(
  target_nomination_id uuid,
  voter_id text,
  rire integer,
  surprise integer,
  gene integer,
  fierte integer,
  interet integer,
  reaction_comment text
)
returns public.nominations
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_nomination public.nominations;
  primary_category_id text;
  computed_points integer;
  computed_score numeric(4,2);
  computed_stars integer;
begin
  if voter_id is null or char_length(voter_id) < 8 or char_length(voter_id) > 96 then
    raise exception 'Identifiant de votant invalide';
  end if;

  select category_id
  into primary_category_id
  from public.nominations
  where id = target_nomination_id;

  if primary_category_id is null then
    raise exception 'Dossier introuvable';
  end if;

  if rire < 0 or rire > 5 or surprise < 0 or surprise > 5 or gene < 0 or gene > 5 or fierte < 0 or fierte > 5 or interet < 0 or interet > 5 then
    raise exception 'Méta-jugement invalide';
  end if;

  reaction_comment := left(btrim(coalesce(reaction_comment, '')), 180);

  computed_points := public.compute_rating_points_for_category(primary_category_id, rire, surprise, gene, fierte, interet);
  computed_score := round((computed_points::numeric / 20), 2);
  computed_stars := round(computed_score)::integer;

  insert into public.ratings (
    nomination_id,
    voter_id,
    rating_stars,
    rating_score,
    rating_points,
    rire_score,
    surprise_score,
    gene_score,
    fierte_score,
    interet_score,
    comment
  )
  values (
    target_nomination_id,
    voter_id,
    computed_stars,
    computed_score,
    computed_points,
    rire,
    surprise,
    gene,
    fierte,
    interet,
    reaction_comment
  )
  on conflict (nomination_id, voter_id) do update set
    rating_stars = excluded.rating_stars,
    rating_score = excluded.rating_score,
    rating_points = excluded.rating_points,
    rire_score = excluded.rire_score,
    surprise_score = excluded.surprise_score,
    gene_score = excluded.gene_score,
    fierte_score = excluded.fierte_score,
    interet_score = excluded.interet_score,
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
    and submitted_by = editor_id::uuid
  returning * into updated_nomination;

  if updated_nomination.id is null then
    raise exception 'Modification verrouillée';
  end if;

  return updated_nomination;
end;
$$;

create or replace function public.update_own_nomination(
  target_nomination_id uuid,
  editor_id text,
  next_comment text,
  next_category_id text,
  next_tiktoker_name text,
  next_category_ids text[]
)
returns public.nominations
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_nomination public.nominations;
  selected_category_ids text[];
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

  selected_category_ids := coalesce(nullif(next_category_ids, '{}'::text[]), array[next_category_id]);
  selected_category_ids := array(
    select selected.category_id
    from (
      select category_id_list.category_id, min(category_id_list.position_index) as first_seen
      from unnest(selected_category_ids) with ordinality as category_id_list(category_id, position_index)
      join public.categories c on c.id = category_id_list.category_id and c.active = true
      group by category_id_list.category_id
    ) as selected
    order by selected.first_seen
  );

  if cardinality(selected_category_ids) = 0 then
    raise exception 'Catégorie invalide';
  end if;

  update public.nominations
  set
    comment = next_comment,
    category_id = selected_category_ids[1],
    category_ids = selected_category_ids,
    tiktoker_name = next_tiktoker_name
  where id = target_nomination_id
    and submitted_by = editor_id::uuid
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
    and submitted_by = editor_id::uuid
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
      nomination_category.category_id,
      n.tiktoker_name,
      n.submitted_by,
      sum(coalesce(r.rating_points, r.rating_stars, 0))::integer as points,
      avg(coalesce(r.rating_score, r.rating_stars, 0))::numeric as average_rating
    from public.nominations n
    join lateral unnest(
      case
        when cardinality(n.category_ids) > 0 then n.category_ids
        else array[n.category_id]
      end
    ) as nomination_category(category_id) on true
    join public.ratings r on r.nomination_id = n.id
    where n.status = 'accepted'
      and n.created_at >= season_month
      and n.created_at < (season_month + interval '1 month')
    group by n.id, nomination_category.category_id, n.tiktoker_name, n.submitted_by
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
grant execute on function public.submit_nomination_vote(uuid, text, integer, integer, integer, integer, integer, text) to anon;
grant execute on function public.compute_rating_points_for_category(text, integer, integer, integer, integer, integer) to anon;
grant execute on function public.update_own_nomination(uuid, text, text, text, text) to anon;
grant execute on function public.update_own_nomination(uuid, text, text, text, text, text[]) to anon;
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
create policy "NOD ratings insert" on public.ratings
for insert to anon with check (true);

drop policy if exists "NOD ratings update" on public.ratings;
create policy "NOD ratings update" on public.ratings
for update to anon using (true) with check (true);

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
