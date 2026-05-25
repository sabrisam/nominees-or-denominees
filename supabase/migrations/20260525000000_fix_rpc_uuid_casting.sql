-- Migration: Fix RPC type mismatches by casting editor_id text to UUID when comparing with submitted_by
CREATE OR REPLACE FUNCTION public.update_own_nomination(
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

CREATE OR REPLACE FUNCTION public.update_own_nomination(
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

CREATE OR REPLACE FUNCTION public.delete_own_nomination(
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
