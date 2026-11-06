insert into auth.users values('44444444-4444-4444-8444-444444444444','eatfirst-v2-owner@example.com'),('55555555-5555-4555-8555-555555555555','eatfirst-v2-member@example.com'),('66666666-6666-4666-8666-666666666666','eatfirst-v2-other@example.com');
set role authenticated;
set request.jwt.claim.sub='44444444-4444-4444-8444-444444444444';
select public.create_household('EatFirst V2 verification cleanup fixture','Temporary owner');
reset role;
