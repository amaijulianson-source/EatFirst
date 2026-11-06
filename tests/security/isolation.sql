\set ON_ERROR_STOP on
insert into auth.users values ('11111111-1111-4111-8111-111111111111','owner@example.test'),('22222222-2222-4222-8222-222222222222','member@example.test'),('33333333-3333-4333-8333-333333333333','outsider@example.test');
create function public.test_assert(ok boolean, label text) returns void language plpgsql as $$ begin if ok is distinct from true then raise exception 'FAILED: %',label; end if; end $$;
set role authenticated;
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
set request.jwt.claim.email='owner@example.test';
select public.create_household('Family A','Owner') as h \gset
select public.create_invitation(:'h','member@example.test')->>'token' as token \gset
select public.test_assert((select count(*) from public.households)=1,'owner can see own household');
select public.test_assert(public.apply_household_changes(:'h','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','[{"table":"shopping_items","key":"milk","expected":null,"next":{"id":"milk","name":"Milk","quantity":"1 bottle","checked":false}}]')->>'revision'='1','owner writes through atomic RPC');
set request.jwt.claim.sub='33333333-3333-4333-8333-333333333333';
set request.jwt.claim.email='outsider@example.test';
select public.test_assert((select count(*) from public.households)=0,'cross-household metadata isolation');
select public.test_assert((select count(*) from public.shopping_items)=0,'cross-household data isolation');
select public.create_household('Family B','Outsider') as other \gset
select public.test_assert((select count(*) from public.households)=1,'outsider sees only own household');
reset role;
select set_config('test.household',:'h',false),set_config('test.token',:'token',false);
set role authenticated;
do $$ begin
 begin perform public.household_snapshot(current_setting('test.household')::uuid);raise exception 'FAILED: forged household snapshot';exception when raise_exception then if sqlerrm not like '%access denied%' then raise; end if; end;
 begin perform public.apply_household_changes(current_setting('test.household')::uuid,gen_random_uuid(),'[]');raise exception 'FAILED: outsider mutation';exception when raise_exception then if sqlerrm not like '%access denied%' then raise; end if; end;
 begin perform public.accept_invitation(current_setting('test.token'),'Intruder');raise exception 'FAILED: invitation email restriction';exception when raise_exception then if sqlerrm not like '%different email%' then raise; end if; end;
 begin insert into public.shopping_items values(current_setting('test.household')::uuid,'hack','{}');raise exception 'FAILED: direct insert';exception when insufficient_privilege then null; end;
end $$;
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
set request.jwt.claim.email='member@example.test';
select public.test_assert(public.accept_invitation(:'token','Member')=:'h'::uuid,'valid invite joins household');
select public.test_assert((select count(*) from public.shopping_items)=1,'member reads shared shopping');
do $$ begin
 begin perform public.accept_invitation(current_setting('test.token'),'Again');raise exception 'FAILED: replayed invitation';exception when raise_exception then if sqlerrm not like '%already used%' then raise; end if; end;
 begin perform public.manage_household(current_setting('test.household')::uuid,'remove','11111111-1111-4111-8111-111111111111');raise exception 'FAILED: member escalates';exception when raise_exception then if sqlerrm not like '%Only the owner%' then raise; end if; end;
end $$;
select public.test_assert(public.apply_household_changes(:'h','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','[{"table":"shopping_items","key":"milk","expected":{"id":"milk","name":"Milk","quantity":"1 bottle","checked":false},"next":{"id":"milk","name":"Milk","quantity":"2 bottles","checked":true}}]')->>'conflict' is null,'member updates shared list');
select public.test_assert(public.apply_household_changes(:'h','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','[{"table":"shopping_items","key":"milk","expected":null,"next":null}]')->>'duplicate'='true','replayed operation acknowledged once');
select public.test_assert(public.apply_household_changes(:'h','cccccccc-cccc-4ccc-8ccc-cccccccccccc','[{"table":"shopping_items","key":"milk","expected":{"id":"milk","name":"Milk","quantity":"1 bottle","checked":false},"next":null}]')->>'conflict'='true','stale simultaneous edit rejected');
select public.test_assert((select data->>'quantity' from public.shopping_items where id='milk')='2 bottles','conflict preserves winning edit');
set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';
select public.manage_household(:'h','remove','22222222-2222-4222-8222-222222222222');
set request.jwt.claim.sub='22222222-2222-4222-8222-222222222222';
select public.test_assert((select count(*) from public.shopping_items)=0,'removed member loses RLS access');
do $$ begin begin perform public.household_snapshot(current_setting('test.household')::uuid);raise exception 'FAILED: removed member snapshot';exception when raise_exception then if sqlerrm not like '%access denied%' then raise; end if; end; end $$;
reset role;
select public.test_assert((select count(*) from public.sync_operations)=2,'only accepted operations recorded');
select public.test_assert((select bool_and(relrowsecurity) from pg_class where oid in ('public.households'::regclass,'public.household_members'::regclass,'public.household_invitations'::regclass,'public.inventory_items'::regclass,'public.shopping_items'::regclass,'public.activity_events'::regclass,'public.frequent_items'::regclass,'public.sync_operations'::regclass)),'RLS enabled on every exposed table');
set role anon;
do $$ begin begin perform * from public.shopping_items;raise exception 'FAILED: anon table access';exception when insufficient_privilege then null; end;begin perform public.create_household('Hack','Anon');raise exception 'FAILED: anon RPC access';exception when insufficient_privilege then null; end;end $$;
reset role;
select 'PASS: isolation, invitations, roles, revocation, idempotency and stale edit protection' as result;
