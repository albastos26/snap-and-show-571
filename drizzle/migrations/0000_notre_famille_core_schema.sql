-- ===== Types =====
create type public.family_role as enum ('admin','member','reader');
create type public.membership_status as enum ('active','pending','removed');
create type public.vital_status as enum ('alive','deceased','unknown');
create type public.date_precision as enum ('exact','year','approx','unknown');
create type public.filiation_kind as enum ('biological','adoptive','step','unknown');
create type public.union_status as enum ('current','past','unknown');
create type public.request_status as enum ('pending','approved','rejected');

-- ===== Families =====
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null,
  role public.family_role not null default 'member',
  status public.membership_status not null default 'active',
  person_id uuid,
  created_at timestamptz not null default now(),
  unique (family_id, user_id)
);
create index memberships_user_idx on public.memberships(user_id);

-- ===== Helper functions (security definer, no RLS recursion) =====
create or replace function public.is_family_member(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.memberships m
    where m.family_id = _family_id and m.user_id = auth.uid() and m.status = 'active');
$$;

create or replace function public.family_role_of(_family_id uuid)
returns public.family_role language sql stable security definer set search_path = public as $$
  select m.role from public.memberships m
  where m.family_id = _family_id and m.user_id = auth.uid() and m.status = 'active' limit 1;
$$;

create or replace function public.is_family_admin(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.family_role_of(_family_id) = 'admin';
$$;

create or replace function public.can_write_family(_family_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.family_role_of(_family_id) in ('admin','member');
$$;

-- ===== Persons =====
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  display_name text not null,
  nickname text,
  birth_date date,
  birth_year integer,
  birth_precision public.date_precision not null default 'unknown',
  vital public.vital_status not null default 'unknown',
  death_date date,
  death_year integer,
  origin_place text,
  bio text,
  photo_path text,
  is_child_record boolean not null default false,
  claimed_by uuid,
  created_by uuid,
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
create index persons_family_idx on public.persons(family_id);
create unique index persons_one_claim_per_family on public.persons(family_id, claimed_by) where claimed_by is not null;

alter table public.memberships
  add constraint memberships_person_fk foreign key (person_id) references public.persons(id) on delete set null;

-- ===== Relations =====
create table public.parent_child_relations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  parent_id uuid not null references public.persons(id) on delete cascade,
  child_id uuid not null references public.persons(id) on delete cascade,
  kind public.filiation_kind not null default 'biological',
  parent_role text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (family_id, parent_id, child_id),
  check (parent_id <> child_id)
);
create index pcr_parent_idx on public.parent_child_relations(parent_id);
create index pcr_child_idx on public.parent_child_relations(child_id);

create table public.partnerships (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  person_a_id uuid not null references public.persons(id) on delete cascade,
  person_b_id uuid not null references public.persons(id) on delete cascade,
  status public.union_status not null default 'current',
  started_on date,
  ended_on date,
  created_by uuid,
  created_at timestamptz not null default now(),
  check (person_a_id <> person_b_id)
);
create unique index partnerships_pair_uniq on public.partnerships(
  family_id, least(person_a_id::text, person_b_id::text), greatest(person_a_id::text, person_b_id::text)
);

-- same-family + cycle guards
create or replace function public.check_relation_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare p_family uuid; c_family uuid;
begin
  if tg_table_name = 'parent_child_relations' then
    select family_id into p_family from public.persons where id = new.parent_id;
    select family_id into c_family from public.persons where id = new.child_id;
    if p_family is null or c_family is null or p_family <> new.family_id or c_family <> new.family_id then
      raise exception 'Les deux personnes doivent appartenir à la même famille';
    end if;
    if exists (
      with recursive anc as (
        select parent_id from public.parent_child_relations where child_id = new.parent_id
        union
        select r.parent_id from public.parent_child_relations r join anc a on r.child_id = a.parent_id
      ) select 1 from anc where parent_id = new.child_id
    ) then
      raise exception 'Cette filiation créerait une boucle dans l''arbre';
    end if;
  else
    select family_id into p_family from public.persons where id = new.person_a_id;
    select family_id into c_family from public.persons where id = new.person_b_id;
    if p_family is null or c_family is null or p_family <> new.family_id or c_family <> new.family_id then
      raise exception 'Les deux personnes doivent appartenir à la même famille';
    end if;
  end if;
  return new;
end;
$$;

create trigger pcr_integrity before insert or update on public.parent_child_relations
for each row execute function public.check_relation_integrity();
create trigger partnership_integrity before insert or update on public.partnerships
for each row execute function public.check_relation_integrity();

-- ===== Contacts (private) =====
create table public.person_contacts (
  person_id uuid primary key references public.persons(id) on delete cascade,
  family_id uuid not null references public.families(id) on delete cascade,
  phone_e164 text,
  whatsapp_declared boolean not null default false,
  share_with_family boolean not null default false,
  consent_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.person_managers (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  user_id uuid not null,
  granted_by uuid,
  created_at timestamptz not null default now(),
  unique (person_id, user_id)
);

create or replace function public.manages_person(_person_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.person_managers pm where pm.person_id = _person_id and pm.user_id = auth.uid())
    or exists (select 1 from public.persons p where p.id = _person_id and p.claimed_by = auth.uid())
    or exists (select 1 from public.persons p where p.id = _person_id and p.created_by = auth.uid() and p.claimed_by is null);
$$;

-- ===== Invitations & requests =====
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  token_hash text not null unique,
  role public.family_role not null default 'member',
  expires_at timestamptz not null default (now() + interval '30 days'),
  max_uses integer not null default 25,
  uses integer not null default 0,
  revoked_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  person_id uuid references public.persons(id) on delete cascade,
  user_id uuid not null,
  note text,
  status public.request_status not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.change_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  target_person_id uuid references public.persons(id) on delete cascade,
  operation jsonb not null,
  base_version integer,
  requested_by uuid not null,
  status public.request_status not null default 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  actor uuid,
  action text not null,
  target_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- ===== Grants =====
grant select, insert, update, delete on public.families to authenticated;
grant select, insert, update, delete on public.memberships to authenticated;
grant select, insert, update, delete on public.persons to authenticated;
grant select, insert, update, delete on public.parent_child_relations to authenticated;
grant select, insert, update, delete on public.partnerships to authenticated;
grant select, insert, update, delete on public.person_contacts to authenticated;
grant select, insert, update, delete on public.person_managers to authenticated;
grant select, insert, update, delete on public.invitations to authenticated;
grant select, insert, update, delete on public.claim_requests to authenticated;
grant select, insert, update, delete on public.change_requests to authenticated;
grant select on public.audit_events to authenticated;
grant all on public.families, public.memberships, public.persons, public.parent_child_relations,
  public.partnerships, public.person_contacts, public.person_managers, public.invitations,
  public.claim_requests, public.change_requests, public.audit_events to service_role;

-- ===== RLS =====
alter table public.families enable row level security;
alter table public.memberships enable row level security;
alter table public.persons enable row level security;
alter table public.parent_child_relations enable row level security;
alter table public.partnerships enable row level security;
alter table public.person_contacts enable row level security;
alter table public.person_managers enable row level security;
alter table public.invitations enable row level security;
alter table public.claim_requests enable row level security;
alter table public.change_requests enable row level security;
alter table public.audit_events enable row level security;

create policy families_select on public.families for select to authenticated
  using (public.is_family_member(id));
create policy families_insert on public.families for insert to authenticated
  with check (created_by = auth.uid());
create policy families_update on public.families for update to authenticated
  using (public.is_family_admin(id));

create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.is_family_member(family_id));
create policy memberships_insert on public.memberships for insert to authenticated
  with check (user_id = auth.uid() or public.is_family_admin(family_id));
create policy memberships_update on public.memberships for update to authenticated
  using (public.is_family_admin(family_id) or user_id = auth.uid());
create policy memberships_delete on public.memberships for delete to authenticated
  using (public.is_family_admin(family_id));

create policy persons_select on public.persons for select to authenticated
  using (public.is_family_member(family_id));
create policy persons_insert on public.persons for insert to authenticated
  with check (public.can_write_family(family_id) and created_by = auth.uid());
create policy persons_update on public.persons for update to authenticated
  using (public.is_family_admin(family_id) or (public.can_write_family(family_id) and public.manages_person(id)));
create policy persons_delete on public.persons for delete to authenticated
  using (public.is_family_admin(family_id));

create policy pcr_select on public.parent_child_relations for select to authenticated
  using (public.is_family_member(family_id));
create policy pcr_insert on public.parent_child_relations for insert to authenticated
  with check (public.can_write_family(family_id));
create policy pcr_update on public.parent_child_relations for update to authenticated
  using (public.is_family_admin(family_id));
create policy pcr_delete on public.parent_child_relations for delete to authenticated
  using (public.is_family_admin(family_id));

create policy partnerships_select on public.partnerships for select to authenticated
  using (public.is_family_member(family_id));
create policy partnerships_insert on public.partnerships for insert to authenticated
  with check (public.can_write_family(family_id));
create policy partnerships_update on public.partnerships for update to authenticated
  using (public.is_family_admin(family_id));
create policy partnerships_delete on public.partnerships for delete to authenticated
  using (public.is_family_admin(family_id));

-- Contacts : lisible seulement si accord explicite, ou si on gère la fiche, ou admin
create policy contacts_select on public.person_contacts for select to authenticated
  using (
    public.manages_person(person_id)
    or public.is_family_admin(family_id)
    or (public.is_family_member(family_id) and share_with_family = true and consent_at is not null)
  );
create policy contacts_write on public.person_contacts for insert to authenticated
  with check (public.manages_person(person_id) or public.is_family_admin(family_id));
create policy contacts_update on public.person_contacts for update to authenticated
  using (public.manages_person(person_id) or public.is_family_admin(family_id));
create policy contacts_delete on public.person_contacts for delete to authenticated
  using (public.manages_person(person_id) or public.is_family_admin(family_id));

create policy managers_select on public.person_managers for select to authenticated
  using (user_id = auth.uid() or public.is_family_admin(family_id));
create policy managers_insert on public.person_managers for insert to authenticated
  with check (public.is_family_admin(family_id));
create policy managers_delete on public.person_managers for delete to authenticated
  using (public.is_family_admin(family_id));

create policy invitations_select on public.invitations for select to authenticated
  using (public.is_family_admin(family_id));
create policy invitations_insert on public.invitations for insert to authenticated
  with check (public.is_family_admin(family_id));
create policy invitations_update on public.invitations for update to authenticated
  using (public.is_family_admin(family_id));

create policy claims_select on public.claim_requests for select to authenticated
  using (user_id = auth.uid() or public.is_family_admin(family_id));
create policy claims_insert on public.claim_requests for insert to authenticated
  with check (user_id = auth.uid());
create policy claims_update on public.claim_requests for update to authenticated
  using (public.is_family_admin(family_id));

create policy changes_select on public.change_requests for select to authenticated
  using (requested_by = auth.uid() or public.is_family_admin(family_id));
create policy changes_insert on public.change_requests for insert to authenticated
  with check (requested_by = auth.uid() and public.is_family_member(family_id));
create policy changes_update on public.change_requests for update to authenticated
  using (public.is_family_admin(family_id));

create policy audit_select on public.audit_events for select to authenticated
  using (public.is_family_admin(family_id));
