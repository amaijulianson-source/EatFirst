#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
run_id="eatfirst-local-${RANDOM}"
stack_db="${run_id}-db"
stack_net="${run_id}-net"
child_pids=()
containers=()
cleanup(){
  for pid in "${child_pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  for name in "${containers[@]}"; do docker rm -f "$name" >/dev/null 2>&1 || true; done
  docker network rm "$stack_net" >/dev/null 2>&1 || true
}
trap cleanup EXIT
mkdir -p test-results/family-local
wait_http(){ for attempt in {1..50}; do if curl -fsS "$1" >/dev/null 2>&1; then return 0; fi; sleep 1; done; echo "Service unavailable: $1" >&2; return 1; }
docker network create "$stack_net" >/dev/null
docker run -d --name "$stack_db" --network "$stack_net" -e POSTGRES_PASSWORD=eatfirst-local-test-only postgres:17-alpine >/dev/null
containers+=("$stack_db")
for attempt in {1..40}; do if docker exec "$stack_db" pg_isready -U postgres >/dev/null 2>&1; then break; fi; sleep 1; done
docker exec "$stack_db" psql -U postgres -v ON_ERROR_STOP=1 -c 'create role anon nologin; create role authenticated nologin; create schema auth;' >/dev/null
start_auth(){
 local name="$1" port="$2" gateway="$3" app="$4" confirm="$5"
 docker run -d --name "$name" --network "$stack_net" -p "127.0.0.1:${port}:9999" \
  -e GOTRUE_API_HOST=0.0.0.0 -e GOTRUE_API_PORT=9999 -e "API_EXTERNAL_URL=http://127.0.0.1:${gateway}" \
  -e "GOTRUE_SITE_URL=http://127.0.0.1:${app}/" -e "GOTRUE_URI_ALLOW_LIST=http://127.0.0.1:${app}/" \
  -e GOTRUE_DB_DRIVER=postgres -e "GOTRUE_DB_DATABASE_URL=postgres://postgres:eatfirst-local-test-only@${stack_db}:5432/postgres?search_path=auth" \
  -e GOTRUE_DB_NAMESPACE=auth -e GOTRUE_JWT_SECRET=eatfirst-local-testing-jwt-secret-at-least-32-chars \
  -e GOTRUE_JWT_AUD=authenticated -e GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated -e "GOTRUE_MAILER_AUTOCONFIRM=${confirm}" \
  -e "GOTRUE_SMTP_HOST=${run_id}-mail" -e GOTRUE_SMTP_PORT=1025 -e GOTRUE_SMTP_ADMIN_EMAIL=auth@eatfirst.test -e GOTRUE_SMTP_SENDER_NAME=EatFirst \
  -e GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify -e GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify \
  -e GOTRUE_DISABLE_SIGNUP=false -e GOTRUE_EXTERNAL_EMAIL_ENABLED=true public.ecr.aws/supabase/gotrue:v2.197.0 >/dev/null
 containers+=("$name")
}
docker run -d --name "${run_id}-mail" --network "$stack_net" -p 127.0.0.1:54327:8025 public.ecr.aws/supabase/mailpit:v1.31.3 >/dev/null
containers+=("${run_id}-mail")
start_auth "${run_id}-auth" 54325 54328 4179 true
wait_http http://127.0.0.1:54325/health
docker exec -i "$stack_db" psql -U postgres -v ON_ERROR_STOP=1 < tests/security/local-auth-bootstrap.sql >/dev/null
docker exec -i "$stack_db" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611060001_family.sql >/dev/null
docker run -d --name "${run_id}-rest" --network "$stack_net" -p 127.0.0.1:54326:3000 \
 -e "PGRST_DB_URI=postgres://postgres:eatfirst-local-test-only@${stack_db}:5432/postgres" -e PGRST_DB_SCHEMAS=public -e PGRST_DB_ANON_ROLE=anon \
 -e PGRST_JWT_SECRET=eatfirst-local-testing-jwt-secret-at-least-32-chars -e PGRST_SERVER_PORT=3000 public.ecr.aws/supabase/postgrest:v16.5 >/dev/null
containers+=("${run_id}-rest")
node tests/security/local-gateway.mjs >test-results/family-local/gateway.log 2>&1 & child_pids+=("$!")
wait_http http://127.0.0.1:54328/auth/v1/health
node tests/security/cloud.integration.mjs
test_anon_key="$(node --input-type=module -e 'import {createHmac} from "node:crypto";const e=o=>Buffer.from(JSON.stringify(o)).toString("base64url");const s=`${e({alg:"HS256",typ:"JWT"})}.${e({role:"anon",iss:"supabase",iat:1700000000,exp:2200000000})}`;console.log(`${s}.${createHmac("sha256","eatfirst-local-testing-jwt-secret-at-least-32-chars").update(s).digest("base64url")}`)')"
VITE_SUPABASE_URL=http://127.0.0.1:54328 VITE_SUPABASE_PUBLISHABLE_KEY="$test_anon_key" npm run build -- --outDir dist-familytest
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4179 --outDir dist-familytest >test-results/family-local/preview.log 2>&1 & child_pids+=("$!")
wait_http http://127.0.0.1:4179/
node tests/security/family-browser.mjs
start_auth "${run_id}-confirm" 54329 54330 4182 false
wait_http http://127.0.0.1:54329/health
LOCAL_AUTH_PORT=54329 LOCAL_GATEWAY_PORT=54330 LOCAL_APP_ORIGIN=http://127.0.0.1:4182 node tests/security/local-gateway.mjs >test-results/family-local/confirmation-gateway.log 2>&1 & child_pids+=("$!")
wait_http http://127.0.0.1:54330/auth/v1/health
VITE_SUPABASE_URL=http://127.0.0.1:54330 VITE_SUPABASE_PUBLISHABLE_KEY="$test_anon_key" npm run build -- --outDir dist-confirmation
node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4182 --outDir dist-confirmation >test-results/family-local/confirmation-preview.log 2>&1 & child_pids+=("$!")
wait_http http://127.0.0.1:4182/
node tests/security/auth-browser.mjs
