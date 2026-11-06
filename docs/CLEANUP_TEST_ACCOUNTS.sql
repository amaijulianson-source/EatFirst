-- Run in the EatFirst Supabase SQL Editor AFTER verification.
-- Deletes ONLY the three agreed disposable accounts and their test households.
-- Stops rather than touching an unexpected household or a real family membership.
begin;
do $$
declare test_ids uuid[];
begin
  select array_agg(id) into test_ids from auth.users
  where lower(email) in ('eatfirst-v2-owner@example.com','eatfirst-v2-member@example.com','eatfirst-v2-other@example.com');
  if test_ids is null then
    raise notice 'No matching temporary test accounts remain.';
    return;
  end if;
  if exists(select 1 from public.households where owner_id=any(test_ids) and name not like 'EatFirst V2 verification %') then
    raise exception 'Unexpected household owned by a test account. Stop and review it manually.';
  end if;
  if exists(select 1 from public.household_members m join public.households h on h.id=m.household_id where m.user_id=any(test_ids) and not (h.owner_id=any(test_ids))) then
    raise exception 'A test account belongs to a non-test household. Stop and review it manually.';
  end if;
  delete from public.households where owner_id=any(test_ids);
  -- Household child tables cascade. These auth accounts have no uploaded storage objects.
  delete from auth.users where id=any(test_ids);
end $$;
select count(*) as remaining_test_accounts from auth.users
where lower(email) in ('eatfirst-v2-owner@example.com','eatfirst-v2-member@example.com','eatfirst-v2-other@example.com');
commit;
