#!/usr/bin/env bash
# Applies the Supabase stub, every migration, the seed and then the SQL tests to a throwaway Postgres.
# Usage: DATABASE_URL=postgres://user:pass@host:5432/dbname scripts/db-test.sh
# The target database is dropped and recreated: never point this at a real project.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL to a throwaway Postgres database}"
case "$DATABASE_URL" in
  *supabase.co*|*supabase.com*) echo "Refusing to run against a Supabase-hosted database." >&2; exit 1 ;;
esac

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "set client_min_messages = warning; drop schema if exists public, private, auth, storage, extensions, tests cascade; create schema public;"
run "$root/supabase/tests/bootstrap/supabase_stub.sql"
for f in "$root"/supabase/migrations/*.sql; do echo "migrate: $(basename "$f")"; run "$f"; done
run "$root/supabase/seed.sql"
for f in "$root"/supabase/tests/*.sql; do echo "test: $(basename "$f")"; run "$f" 2>&1 | sed -n 's/^psql:.*NOTICE:  //p;/FAIL\|ERROR/p'; test "${PIPESTATUS[0]}" -eq 0; done
echo "Database tests passed."
