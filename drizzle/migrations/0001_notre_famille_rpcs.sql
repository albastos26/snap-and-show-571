create extension if not exists pgcrypto with schema extensions;

-- Créer une famille + fiche du créateur (transactionnel)
create or replace function public.create_family(_name text, _person_name text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare fid uuid; pid uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  insert into public.families(name, created_by) values (trim(_name), auth.uid()) returning id into fid;
  insert into public.persons(family_id, display_name, created_by, claimed_by, vital)
    values (fid, trim(_person_name), auth.uid(), auth.uid(), 'alive') returning id into pid;
  insert into public.memberships(family_id, user_id, role, status, person_id)
    values (fid, auth.uid(), 'admin', 'active', pid);
  insert into public.audit_events(family_id, actor, action, target_id)
    values (fid, auth.uid(), 'family.create', fid);
  return fid;
end;
$$;

-- Ajouter un proche : personne + lien dans une seule transaction
create or replace function public.add_relative(
  _family_id uuid,
  _name text,
  _relation text,
  _anchor_id uuid,
  _other_parent_id uuid default null,
  _sibling_parent_ids uuid[] default null,
  _kind public.filiation_kind default 'biological',
  _vital public.vital_status default 'unknown',
  _birth_year integer default null,
  _is_child_record boolean default false
) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid; sp uuid;
begin
  if not public.can_write_family(_family_id) then raise exception 'Droits insuffisants'; end if;
  if _anchor_id is not null and not exists (select 1 from public.persons where id = _anchor_id and family_id = _family_id) then
    raise exception 'Personne de départ introuvable dans cette famille';
  end if;

  insert into public.persons(family_id, display_name, created_by, vital, birth_year,
      birth_precision, is_child_record)
    values (_family_id, trim(_name), auth.uid(), _vital, _birth_year,
      case when _birth_year is null then 'unknown' else 'year' end, coalesce(_is_child_record,false))
    returning id into pid;

  if _relation = 'parent' then
    insert into public.parent_child_relations(family_id, parent_id, child_id, kind, created_by)
      values (_family_id, pid, _anchor_id, _kind, auth.uid());
  elsif _relation = 'child' then
    insert into public.parent_child_relations(family_id, parent_id, child_id, kind, created_by)
      values (_family_id, _anchor_id, pid, _kind, auth.uid());
    if _other_parent_id is not null then
      insert into public.parent_child_relations(family_id, parent_id, child_id, kind, created_by)
        values (_family_id, _other_parent_id, pid, _kind, auth.uid())
        on conflict do nothing;
    end if;
  elsif _relation = 'partner' then
    insert into public.partnerships(family_id, person_a_id, person_b_id, status, created_by)
      values (_family_id, _anchor_id, pid, 'current', auth.uid());
  elsif _relation = 'sibling' then
    if _sibling_parent_ids is null or array_length(_sibling_parent_ids,1) is null then
      raise exception 'Indiquez au moins un parent commun pour créer un lien de fratrie';
    end if;
    foreach sp in array _sibling_parent_ids loop
      insert into public.parent_child_relations(family_id, parent_id, child_id, kind, created_by)
        values (_family_id, sp, pid, _kind, auth.uid()) on conflict do nothing;
    end loop;
  else
    raise exception 'Relation inconnue: %', _relation;
  end if;

  insert into public.audit_events(family_id, actor, action, target_id, payload)
    values (_family_id, auth.uid(), 'person.add_relative', pid,
      jsonb_build_object('relation', _relation, 'anchor', _anchor_id));
  return pid;
end;
$$;

-- Lier deux personnes existantes
create or replace function public.link_persons(
  _family_id uuid, _relation text, _a uuid, _b uuid, _kind public.filiation_kind default 'biological'
) returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_write_family(_family_id) then raise exception 'Droits insuffisants'; end if;
  if _relation = 'parent_of' then
    insert into public.parent_child_relations(family_id, parent_id, child_id, kind, created_by)
      values (_family_id, _a, _b, _kind, auth.uid()) on conflict do nothing;
  elsif _relation = 'partner' then
    insert into public.partnerships(family_id, person_a_id, person_b_id, created_by)
      values (_family_id, _a, _b, auth.uid()) on conflict do nothing;
  else raise exception 'Relation inconnue'; end if;
end;
$$;

-- Invitations
create or replace function public.create_invitation(_family_id uuid, _token text, _days integer default 30, _max_uses integer default 25)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare iid uuid;
begin
  if not public.is_family_admin(_family_id) then raise exception 'Réservé aux administrateurs'; end if;
  insert into public.invitations(family_id, token_hash, role, expires_at, max_uses, created_by)
    values (_family_id, encode(digest(_token,'sha256'),'hex'), 'member', now() + (_days || ' days')::interval, _max_uses, auth.uid())
    returning id into iid;
  return iid;
end;
$$;

create or replace function public.invitation_preview(_token text)
returns table(family_id uuid, family_name text, valid boolean, reason text)
language plpgsql security definer set search_path = public, extensions as $$
declare inv public.invitations; fam public.families;
begin
  select * into inv from public.invitations where token_hash = encode(digest(_token,'sha256'),'hex');
  if inv.id is null then return query select null::uuid, null::text, false, 'introuvable'; return; end if;
  select * into fam from public.families where id = inv.family_id;
  if inv.revoked_at is not null then return query select fam.id, fam.name, false, 'revoquee'; return; end if;
  if inv.expires_at < now() then return query select fam.id, fam.name, false, 'expiree'; return; end if;
  if inv.uses >= inv.max_uses then return query select fam.id, fam.name, false, 'epuisee'; return; end if;
  return query select fam.id, fam.name, true, null::text;
end;
$$;
grant execute on function public.invitation_preview(text) to anon, authenticated;

create or replace function public.accept_invitation(_token text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare inv public.invitations;
begin
  if auth.uid() is null then raise exception 'Connexion requise'; end if;
  select * into inv from public.invitations where token_hash = encode(digest(_token,'sha256'),'hex') for update;
  if inv.id is null then raise exception 'Invitation introuvable'; end if;
  if inv.revoked_at is not null then raise exception 'Invitation révoquée'; end if;
  if inv.expires_at < now() then raise exception 'Invitation expirée'; end if;
  if inv.uses >= inv.max_uses then raise exception 'Invitation épuisée'; end if;

  if not exists (select 1 from public.memberships where family_id = inv.family_id and user_id = auth.uid()) then
    insert into public.memberships(family_id, user_id, role, status)
      values (inv.family_id, auth.uid(), 'member', 'active');
    update public.invitations set uses = uses + 1 where id = inv.id;
    insert into public.audit_events(family_id, actor, action, target_id)
      values (inv.family_id, auth.uid(), 'membership.join', auth.uid());
  end if;
  return inv.family_id;
end;
$$;

-- Demande de rattachement à une fiche existante
create or replace function public.request_claim(_family_id uuid, _person_id uuid, _note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if not public.is_family_member(_family_id) then raise exception 'Non membre'; end if;
  if _person_id is not null and exists (select 1 from public.persons where id = _person_id and claimed_by is not null) then
    raise exception 'Cette fiche est déjà rattachée à un compte';
  end if;
  insert into public.claim_requests(family_id, person_id, user_id, note)
    values (_family_id, _person_id, auth.uid(), _note) returning id into rid;
  return rid;
end;
$$;

create or replace function public.review_claim(_claim_id uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare c public.claim_requests;
begin
  select * into c from public.claim_requests where id = _claim_id;
  if c.id is null then raise exception 'Demande introuvable'; end if;
  if not public.is_family_admin(c.family_id) then raise exception 'Réservé aux administrateurs'; end if;
  update public.claim_requests set status = case when _approve then 'approved' else 'rejected' end,
    reviewed_by = auth.uid(), reviewed_at = now() where id = _claim_id;
  if _approve and c.person_id is not null then
    update public.persons set claimed_by = c.user_id where id = c.person_id;
    update public.memberships set person_id = c.person_id where family_id = c.family_id and user_id = c.user_id;
    delete from public.person_managers where person_id = c.person_id and user_id <> c.user_id;
  end if;
  insert into public.audit_events(family_id, actor, action, target_id, payload)
    values (c.family_id, auth.uid(), 'claim.review', c.person_id, jsonb_build_object('approved', _approve));
end;
$$;

-- Créer sa propre fiche lors de l'inscription (nouveau membre) + lien à un proche
create or replace function public.create_self_person(
  _family_id uuid, _name text, _relation text default null, _anchor_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not public.is_family_member(_family_id) then raise exception 'Non membre'; end if;
  if exists (select 1 from public.memberships where family_id = _family_id and user_id = auth.uid() and person_id is not null) then
    raise exception 'Votre compte est déjà rattaché à une fiche';
  end if;
  insert into public.persons(family_id, display_name, created_by, claimed_by, vital)
    values (_family_id, trim(_name), auth.uid(), auth.uid(), 'alive') returning id into pid;
  update public.memberships set person_id = pid where family_id = _family_id and user_id = auth.uid();

  if _anchor_id is not null and _relation is not null then
    if _relation = 'parent' then
      insert into public.parent_child_relations(family_id, parent_id, child_id, created_by)
        values (_family_id, _anchor_id, pid, auth.uid());
    elsif _relation = 'child' then
      insert into public.parent_child_relations(family_id, parent_id, child_id, created_by)
        values (_family_id, pid, _anchor_id, auth.uid());
    elsif _relation = 'partner' then
      insert into public.partnerships(family_id, person_a_id, person_b_id, created_by)
        values (_family_id, pid, _anchor_id, auth.uid());
    end if;
  end if;
  insert into public.audit_events(family_id, actor, action, target_id)
    values (_family_id, auth.uid(), 'person.create_self', pid);
  return pid;
end;
$$;

-- Export administrateur (sans coordonnées privées)
create or replace function public.export_family(_family_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare res jsonb;
begin
  if not public.is_family_admin(_family_id) then raise exception 'Réservé aux administrateurs'; end if;
  select jsonb_build_object(
    'schema_version', 1,
    'exported_at', now(),
    'family', (select jsonb_build_object('id', id, 'name', name) from public.families where id = _family_id),
    'persons', coalesce((select jsonb_agg(to_jsonb(p) - 'photo_path') from public.persons p where p.family_id = _family_id), '[]'::jsonb),
    'parent_child_relations', coalesce((select jsonb_agg(to_jsonb(r)) from public.parent_child_relations r where r.family_id = _family_id), '[]'::jsonb),
    'partnerships', coalesce((select jsonb_agg(to_jsonb(u)) from public.partnerships u where u.family_id = _family_id), '[]'::jsonb)
  ) into res;
  return res;
end;
$$;
