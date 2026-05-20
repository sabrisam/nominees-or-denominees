-- Nominees or Denominees - Supabase foundation
-- Run this file in Supabase SQL Editor before starting the PWA.

create extension if not exists pgcrypto;

do $$ begin
  create type public.nod_player_role as enum ('player_1', 'player_2');
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.nomination_status as enum ('pending', 'accepted', 'rejected', 'arena');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) between 3 and 24),
  player1_label text not null default 'Joueur 1',
  player2_label text not null default 'Joueur 2',
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
  comment text not null check (char_length(comment) between 3 and 240),
  submitted_by public.nod_player_role not null,
  status public.nomination_status not null default 'pending',
  votes jsonb not null default '{}'::jsonb check (jsonb_typeof(votes) = 'object'),
  arguments jsonb not null default '[]'::jsonb check (jsonb_typeof(arguments) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trial_rounds (
  id uuid primary key default gen_random_uuid(),
  nomination_id uuid not null references public.nominations(id) on delete cascade,
  round_number integer not null check (round_number between 1 and 3),
  player_role public.nod_player_role not null,
  body text not null check (char_length(body) between 3 and 180),
  created_at timestamptz not null default now(),
  unique (nomination_id, round_number, player_role)
);

create index if not exists rooms_code_idx on public.rooms(code);
create index if not exists nominations_room_created_idx on public.nominations(room_id, created_at desc);
create index if not exists nominations_room_status_idx on public.nominations(room_id, status);
create index if not exists nominations_video_path_idx on public.nominations(video_storage_path)
  where video_storage_path is not null;
create index if not exists trial_rounds_nomination_idx on public.trial_rounds(nomination_id, round_number);

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

insert into public.categories (id, label, mood, sort_order) values
  ('moment_marquant', 'Moment marquant', 'positive', 1),
  ('pepite_cachee', 'Pepite cachee', 'positive', 2),
  ('style_remarquable', 'Style remarquable', 'positive', 3),
  ('replique_culte', 'Replique culte', 'positive', 4),
  ('elan_creatif', 'Elan creatif', 'positive', 5),
  ('malaise_public', 'Malaise public', 'critical', 6),
  ('signal_alerte', 'Signal d''alerte', 'critical', 7),
  ('derapage_leger', 'Derapage leger', 'critical', 8),
  ('choix_discutable', 'Choix discutable', 'critical', 9),
  ('silence_genant', 'Silence genant', 'critical', 10),
  ('fou_rire', 'Fou rire du mois', 'fun', 11),
  ('scene_improbable', 'Scene improbable', 'fun', 12),
  ('roue_libre', 'Roue libre', 'fun', 13),
  ('performance_surprise', 'Performance surprise', 'fun', 14),
  ('voyage_express', 'Voyage express', 'fun', 15)
on conflict (id) do update set
  label = excluded.label,
  mood = excluded.mood,
  sort_order = excluded.sort_order,
  active = true;

alter table public.rooms enable row level security;
alter table public.categories enable row level security;
alter table public.nominations enable row level security;
alter table public.trial_rounds enable row level security;

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
create policy "NOD nominations write" on public.nominations
for all to anon using (true) with check (true);

drop policy if exists "NOD trial rounds read" on public.trial_rounds;
create policy "NOD trial rounds read" on public.trial_rounds
for select to anon using (true);

drop policy if exists "NOD trial rounds write" on public.trial_rounds;
create policy "NOD trial rounds write" on public.trial_rounds
for all to anon using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'nod-media',
  'nod-media',
  true,
  52428800,
  array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "NOD media public read" on storage.objects;
create policy "NOD media public read" on storage.objects
for select to anon using (bucket_id = 'nod-media');

drop policy if exists "NOD media upload" on storage.objects;
create policy "NOD media upload" on storage.objects
for insert to anon with check (
  bucket_id = 'nod-media'
  and (storage.foldername(name))[1] in ('videos', 'thumbnails')
);

drop policy if exists "NOD media update" on storage.objects;
create policy "NOD media update" on storage.objects
for update to anon using (bucket_id = 'nod-media') with check (bucket_id = 'nod-media');

drop policy if exists "NOD media delete" on storage.objects;
create policy "NOD media delete" on storage.objects
for delete to anon using (bucket_id = 'nod-media');
