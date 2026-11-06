begin;
create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
create table if not exists public.households (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 80),
 owner_id uuid not null references auth.users(id), revision bigint not null default 0,
 settings jsonb not null default '{"staples":["salt","pepper","oil","water"],"diet":[],"currency":"USD"}', created_at timestamptz not null default now()
);
create table if not exists public.household_members (
 household_id uuid references public.households on delete cascade, user_id uuid references auth.users on delete cascade,
 role text not null check(role in ('owner','member')), display_name text not null check(length(display_name) between 1 and 80), joined_at timestamptz not null default now(), primary key(household_id,user_id)
);
create table if not exists public.household_invitations (
 id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households on delete cascade,
 token_hash text not null unique, email text, expires_at timestamptz not null default now()+interval '48 hours',
 created_by uuid not null references auth.users, claimed_by uuid references auth.users, revoked boolean not null default false
);
create table if not exists public.inventory_items (household_id uuid references public.households on delete cascade, id text not null, data jsonb not null, primary key(household_id,id));
create table if not exists public.shopping_items (like public.inventory_items including all);
alter table public.shopping_items drop constraint if exists shopping_items_household_id_fkey;
alter table public.shopping_items add constraint shopping_items_household_id_fkey foreign key(household_id) references public.households on delete cascade;
create table if not exists public.activity_events (like public.inventory_items including all);
alter table public.activity_events drop constraint if exists activity_events_household_id_fkey;
alter table public.activity_events add constraint activity_events_household_id_fkey foreign key(household_id) references public.households on delete cascade;
create table if not exists public.frequent_items (like public.inventory_items including all);
alter table public.frequent_items drop constraint if exists frequent_items_household_id_fkey;
alter table public.frequent_items add constraint frequent_items_household_id_fkey foreign key(household_id) references public.households on delete cascade;
create table if not exists public.sync_operations (household_id uuid references public.households on delete cascade, operation_id uuid not null, user_id uuid not null, revision bigint not null, primary key(household_id,operation_id));

create or replace function public.is_household_member(h uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.household_members where household_id=h and user_id=auth.uid()) $$;
create or replace function public.is_household_owner(h uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.households where id=h and owner_id=auth.uid()) $$;
revoke all on function public.is_household_member(uuid),public.is_household_owner(uuid) from public,anon;
grant execute on function public.is_household_member(uuid),public.is_household_owner(uuid) to authenticated;
do $$ declare t text; begin
 foreach t in array array['households','household_members','household_invitations','inventory_items','shopping_items','activity_events','frequent_items','sync_operations'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 end loop;
end $$;
grant select on public.households,public.household_members,public.household_invitations,public.inventory_items,public.shopping_items,public.activity_events,public.frequent_items to authenticated;
drop policy if exists member_read on public.households;
create policy member_read on public.households for select to authenticated using(public.is_household_member(id));
drop policy if exists member_read on public.household_members;
create policy member_read on public.household_members for select to authenticated using(public.is_household_member(household_id));
drop policy if exists owner_read on public.household_invitations;
create policy owner_read on public.household_invitations for select to authenticated using(public.is_household_owner(household_id));
do $$ declare t text; begin foreach t in array array['inventory_items','shopping_items','activity_events','frequent_items'] loop
 execute format('drop policy if exists member_read on public.%I',t);
 execute format('create policy member_read on public.%I for select to authenticated using(public.is_household_member(household_id))',t);
 end loop; end $$;

create or replace function public.create_household(household_name text, member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare h uuid; begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if length(trim(household_name)) not between 1 and 80 or length(trim(member_name)) not between 1 and 80 then raise exception 'Choose a household name and display name (1–80 characters)'; end if;
 if (select count(*) from public.household_members where user_id=auth.uid())>=10 then raise exception 'Household limit reached'; end if;
 insert into public.households(name,owner_id) values(trim(household_name),auth.uid()) returning id into h;
 insert into public.household_members(household_id,user_id,role,display_name) values(h,auth.uid(),'owner',trim(member_name)); return h; end $$;
create or replace function public.create_invitation(h uuid, target_email text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare token text; iid uuid; begin
 if not public.is_household_owner(h) then raise exception 'Only the household owner can invite members'; end if;
 if (select count(*) from public.household_invitations where household_id=h and not revoked and claimed_by is null and expires_at>now())>=50 then raise exception 'Revoke unused invitations first'; end if;
 if target_email is not null and (length(target_email)>254 or position('@' in target_email)=0) then raise exception 'Invalid email'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 insert into public.household_invitations(household_id,token_hash,email,created_by) values(h,encode(extensions.digest(token,'sha256'),'hex'),nullif(lower(trim(target_email)),''),auth.uid()) returning id into iid;
 return jsonb_build_object('id',iid,'token',token,'expires_at',now()+interval '48 hours'); end $$;
create or replace function public.accept_invitation(token text, member_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare inv public.household_invitations; begin
 if auth.uid() is null then raise exception 'Sign in before accepting an invitation'; end if;
 if length(token)<>64 or length(trim(member_name)) not between 1 and 80 then raise exception 'Invalid invitation or display name'; end if;
 select * into inv from public.household_invitations where token_hash=encode(extensions.digest(token,'sha256'),'hex') for update;
 if inv.id is null or inv.revoked or inv.expires_at<=now() or inv.claimed_by is not null then raise exception 'Invitation is invalid, expired or already used'; end if;
 if inv.email is not null and inv.email<>lower(auth.jwt()->>'email') then raise exception 'This invitation belongs to a different email address'; end if;
 insert into public.household_members(household_id,user_id,role,display_name) values(inv.household_id,auth.uid(),'member',trim(member_name)) on conflict do nothing;
 update public.household_invitations set claimed_by=auth.uid() where id=inv.id;
 update public.households set revision=revision+1 where id=inv.household_id;
 return inv.household_id; end $$;
create or replace function public.manage_household(h uuid, command text, target uuid default null, new_name text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.households where id=h for update;
 if not public.is_household_member(h) then raise exception 'Household access denied'; end if;
 if command='leave' and not public.is_household_owner(h) then delete from public.household_members where household_id=h and user_id=auth.uid();
 elsif not public.is_household_owner(h) then raise exception 'Only the owner can manage this household';
 elsif command='remove' and target<>(select owner_id from public.households where id=h) then delete from public.household_members where household_id=h and user_id=target;
 elsif command='revoke' then update public.household_invitations set revoked=true where household_id=h and id=target;
 elsif command='rename' and length(trim(new_name)) between 1 and 80 then update public.households set name=trim(new_name) where id=h;
 else raise exception 'Invalid operation; the owner cannot be removed'; end if;
 update public.households set revision=revision+1 where id=h; end $$;

-- Client mutations are never allowed to write tables directly, including owners.
create or replace function public.family_record_valid(kind text, v jsonb) returns boolean language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(v)<>'object' then return false; end if;
 if kind='settings' then return jsonb_typeof(v->'staples')='array' and jsonb_typeof(v->'diet')='array' and v->>'currency' in ('USD','EUR','GBP','CAD','AUD') and jsonb_array_length(v->'staples')<=200 and jsonb_array_length(v->'diet')<=3 and not exists(select 1 from jsonb_array_elements(v->'staples') x where jsonb_typeof(x)<>'string') and not exists(select 1 from jsonb_array_elements_text(v->'diet') x where x not in ('vegetarian','vegan','gluten-free')); end if;
 if jsonb_typeof(v->'id')<>'string' or length(v->>'id') not between 1 and 200 then return false; end if;
 if kind='activity_events' then return public.family_record_valid('inventory_items',v->'food') and v->>'action' in ('eaten','used','discarded') and (v->>'amount')::numeric>0 and (v->>'amount')::numeric<=(v->'food'->>'quantity')::numeric and (v->>'date')::date::text=v->>'date' and (not v?'value' or (v->>'value')::numeric>=0); end if;
 if jsonb_typeof(v->'name')<>'string' or length(trim(v->>'name')) not between 1 and 100 then return false; end if;
 if kind='inventory_items' then return jsonb_typeof(v->'quantity')='number' and (v->>'quantity')::numeric>0 and (v->>'quantity')::numeric<=1000000 and jsonb_typeof(v->'unit')='string' and v->>'category' in ('Produce','Dairy','Meat & fish','Bread & bakery','Cooked leftovers','Drinks','Frozen food','Pantry','Other') and v->>'location' in ('Fridge','Freezer','Pantry') and (v->>'added')::date::text=v->>'added' and (v->>'expiry'='' or (v->>'expiry')::date::text=v->>'expiry') and v->>'dateType' in ('use-by','best-before') and jsonb_typeof(v->'notes')='string' and (not v?'value' or (v->>'value')::numeric>=0); end if;
 if kind='shopping_items' then return jsonb_typeof(v->'quantity')='string' and jsonb_typeof(v->'checked')='boolean' and (not v?'priority' or jsonb_typeof(v->'priority')='boolean'); end if;
 if kind='frequent_items' then return jsonb_typeof(v->'count')='number' and (v->>'count')::integer>=0 and jsonb_typeof(v->'quantity')='string' and (v->>'lastPurchased')::date::text=v->>'lastPurchased'; end if;
 return false;
 exception when others then return false; end $$;
create or replace function public.apply_household_changes(h uuid, operation uuid, changes jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; t text; k text; current_value jsonb; rev bigint; prior public.sync_operations; begin
 -- Lock ordering serializes edits, membership removal and operation replay.
 perform 1 from public.households where id=h for update;
 if not public.is_household_member(h) then raise exception 'Household access denied'; end if;
 select * into prior from public.sync_operations where household_id=h and operation_id=operation;
 if prior.operation_id is not null then
 if prior.user_id<>auth.uid() then raise exception 'Operation belongs to another member'; end if;
 return jsonb_build_object('revision',prior.revision,'duplicate',true); end if;
 if jsonb_typeof(changes)<>'array' or jsonb_array_length(changes) not between 1 and 5000 then raise exception 'Invalid change batch (maximum 5000)'; end if;
 if exists(select 1 from jsonb_array_elements(changes) a group by a->>'table',a->>'key' having count(*)>1) then raise exception 'Duplicate keys in change batch'; end if;
 for c in select * from jsonb_array_elements(changes) loop
 t:=c->>'table'; k:=c->>'key';
 if t not in ('inventory_items','shopping_items','activity_events','frequent_items','settings') or k is null then raise exception 'Invalid table or key'; end if;
 if t='settings' then select settings into current_value from public.households where id=h;
 else execute format('select data from public.%I where household_id=$1 and id=$2',t) into current_value using h,k; end if;
 if coalesce(current_value,'null'::jsonb) is distinct from coalesce(c->'expected','null'::jsonb) then return jsonb_build_object('conflict',true,'table',t,'key',k,'current',current_value); end if;
 if c->'next'<>'null'::jsonb and (not coalesce(public.family_record_valid(t,c->'next'),false) or (t<>'settings' and c->'next'->>'id' is distinct from k)) then raise exception 'Invalid record'; end if;
 if t='settings' and (k<>'settings' or c->'next' is null or c->'next'='null'::jsonb) then raise exception 'Invalid settings'; end if;
 if not c?'next' or not c?'expected' then raise exception 'Missing change fields'; end if;
 end loop;
 for c in select * from jsonb_array_elements(changes) loop
 t:=c->>'table'; k:=c->>'key';
 if t='settings' then update public.households set settings=c->'next' where id=h;
 elsif c->'next'='null'::jsonb then execute format('delete from public.%I where household_id=$1 and id=$2',t) using h,k;
 else execute format('insert into public.%I(household_id,id,data) values($1,$2,$3) on conflict(household_id,id) do update set data=excluded.data',t) using h,k,c->'next'; end if;
 end loop;
 update public.households set revision=revision+1 where id=h returning revision into rev;
 insert into public.sync_operations values(h,operation,auth.uid(),rev);
 return jsonb_build_object('revision',rev); end $$;
create or replace function public.household_snapshot(h uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; begin
 if not public.is_household_member(h) then raise exception 'Household access denied'; end if;
 select jsonb_build_object('id',id,'name',name,'owner_id',owner_id,'revision',revision,'settings',settings,
 'foods',coalesce((select jsonb_agg(data order by id) from public.inventory_items where household_id=h),'[]'),
 'shopping',coalesce((select jsonb_agg(data order by id) from public.shopping_items where household_id=h),'[]'),
 'events',coalesce((select jsonb_agg(data order by id) from public.activity_events where household_id=h),'[]'),
 'frequent',coalesce((select jsonb_agg(data order by id) from public.frequent_items where household_id=h),'[]')) into result from public.households where id=h;
 return result; end $$;
revoke all on function public.create_household(text,text),public.create_invitation(uuid,text),public.accept_invitation(text,text),public.manage_household(uuid,text,uuid,text),public.family_record_valid(text,jsonb),public.apply_household_changes(uuid,uuid,jsonb),public.household_snapshot(uuid) from public,anon;
grant execute on function public.create_household(text,text),public.create_invitation(uuid,text),public.accept_invitation(text,text),public.manage_household(uuid,text,uuid,text),public.apply_household_changes(uuid,uuid,jsonb),public.household_snapshot(uuid) to authenticated;
do $$ begin if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='households') then alter publication supabase_realtime add table public.households; end if; end $$;
commit;
