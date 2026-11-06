#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
container_name="eatfirst-policy-check-${RANDOM}"
trap 'docker rm -f "$container_name" >/dev/null 2>&1 || true' EXIT
docker run -d --network none --name "$container_name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17-alpine >/dev/null
for attempt in {1..40}; do
  if docker exec "$container_name" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < tests/security/bootstrap.sql
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202611060001_family.sql
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < tests/security/isolation.sql
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < tests/security/cleanup.fixture.sql
docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 < docs/CLEANUP_TEST_ACCOUNTS.sql
docker exec "$container_name" psql -U postgres -v ON_ERROR_STOP=1 -c "select public.test_assert((select count(*) from auth.users)=3,'cleanup preserves all original non-test accounts'), public.test_assert((select count(*) from public.households)=2,'cleanup preserves non-test households');"
