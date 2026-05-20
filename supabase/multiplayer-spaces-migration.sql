-- Nominees or Denominees - migration vers sessions multijoueurs + Spaces
-- À exécuter une seule fois dans le SQL Editor Supabase si le schéma initial à 2 joueurs existe déjà.

create extension if not exists pgcrypto;

do $$ begin
  create type public.nomination_status as enum ('pending', 'accepted', 'rejected');
exception
  when duplicate_object then null;
end $$;

alter table public.rooms
  drop column if exists player1_label,
  drop column if exists player2_label;

alter table public.nominations
  alter column submitted_by type text using submitted_by::text,
  drop column if exists arguments;

drop table if exists public.trial_rounds;

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
    status = public.nod_status_from_votes(jsonb_set(coalesce(votes, '{}'::jsonb), array[voter_id], vote_payload, true))
  where id = target_nomination_id
  returning * into updated_nomination;

  if updated_nomination.id is null then
    raise exception 'Dossier introuvable';
  end if;

  return updated_nomination;
end;
$$;

grant execute on function public.submit_nomination_vote(uuid, text, jsonb) to anon;

update public.nominations
set status = public.nod_status_from_votes(votes);
