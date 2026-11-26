#!/usr/bin/env bash
# P0-R3.1 controlled backup + migration for test project vcmegbghsaqagikfxces only.
# Does NOT persist database password to disk or git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
CLI="npx --yes supabase@3.4.0"
REPORT="backups/p0r31-run-report-$(date +%Y%m%d-%H%M%S).txt"
mkdir -p backups

exec > >(tee -a "$REPORT") 2>&1

echo "== P0-R3.1 controlled remote ops =="
echo "project_ref=$(cat supabase/.temp/project-ref 2>/dev/null || echo unknown)"
echo "started_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"

if [[ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "vcmegbghsaqagikfxces" ]]; then
  echo "ABORT: linked project is not vcmegbghsaqagikfxces"
  exit 1
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
  read -rs -p "Supabase database password (test project only): " SUPABASE_DB_PASSWORD
  export SUPABASE_DB_PASSWORD
  echo
fi

STAMP=$(date +%Y%m%d-%H%M%S)
SCHEMA_FILE="backups/pre-p0r31-${STAMP}.schema.sql"
DATA_FILE="backups/pre-p0r31-${STAMP}.data.sql"

echo "== 1) Backup schema =="
$CLI db dump --remote -p "$SUPABASE_DB_PASSWORD" -f "$SCHEMA_FILE" --schema public
echo "schema_bytes=$(wc -c < "$SCHEMA_FILE" | tr -d ' ')"

echo "== 2) Backup data (public) =="
$CLI db dump --remote -p "$SUPABASE_DB_PASSWORD" -f "$DATA_FILE" --data-only --use-copy --schema public
echo "data_bytes=$(wc -c < "$DATA_FILE" | tr -d ' ')"

if [[ ! -s "$SCHEMA_FILE" ]]; then
  echo "ABORT: schema backup empty"
  unset SUPABASE_DB_PASSWORD
  exit 1
fi

echo "== 3) Preflight (read-only) =="
$CLI db query --remote --read-only -f scripts/preflight-p0r31-readonly.sql

echo "== 4) Migration dry-run =="
$CLI db push --remote --dry-run --yes -p "$SUPABASE_DB_PASSWORD"

if [[ "${P0R31_APPLY_MIGRATION:-}" != "yes" ]]; then
  read -rp "Apply P0-R3.1 migration to TEST database? Type yes: " confirm
else
  confirm=yes
fi

if [[ "$confirm" == "yes" ]]; then
  echo "== 5) Apply migration =="
  $CLI db push --remote --yes -p "$SUPABASE_DB_PASSWORD"
  echo "== 6) Postflight =="
  $CLI db query --remote --read-only -f scripts/postflight-p0r31-readonly.sql
  if [[ -f scripts/p0r31-integration-tests.sql ]]; then
    echo "== 7) DB integration tests =="
    $CLI db query --remote -f scripts/p0r31-integration-tests.sql
  fi
else
  echo "SKIPPED: migration apply (confirm != yes)"
fi

unset SUPABASE_DB_PASSWORD
echo "completed_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "report_file=$REPORT"
echo "Done. Password cleared from shell environment."