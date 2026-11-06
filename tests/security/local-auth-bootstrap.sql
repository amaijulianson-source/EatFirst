-- Disposable local GoTrue/PostgREST instance only. Never run against the hosted project.
create or replace function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create or replace function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),'')::jsonb,'{}'::jsonb) $$;
grant usage on schema auth, public to anon, authenticated;
grant execute on function auth.uid(),auth.jwt() to anon,authenticated;
