#!/usr/bin/env bash
# Link cloud-sniffer to Vercel and push env vars. Run locally where `vercel login` works.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel"
  exit 1
fi

if ! vercel whoami >/dev/null 2>&1; then
  echo "Not logged in. Run: vercel login"
  exit 1
fi

ENV_FILE="${ENV_FILE:-$ROOT/.env.local}"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.example and set DATABASE_URL (+ tokens)."
  exit 1
fi

# shellcheck disable=SC1090
set -a && source "$ENV_FILE" && set +a

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL must be set in $ENV_FILE"
  exit 1
fi

if [[ -z "${CRON_SECRET:-}" ]]; then
  CRON_SECRET="$(openssl rand -hex 32)"
  echo "Generated CRON_SECRET (add to $ENV_FILE for local cron tests):"
  echo "CRON_SECRET=$CRON_SECRET"
  echo ""
fi

if [[ -z "${VERCEL_ACCESS_TOKEN:-}" ]]; then
  echo "VERCEL_ACCESS_TOKEN is not set in $ENV_FILE."
  echo "Create a token: https://vercel.com/account/tokens"
  echo "Scope: read billing for your team (Owner/Billing role on team)."
  echo "Add to $ENV_FILE: VERCEL_ACCESS_TOKEN=..."
  exit 1
fi

echo "==> Linking project (creates .vercel/ if needed)"
vercel link --yes

add_env() {
  local name="$1"
  local value="$2"
  for target in production preview development; do
    printf '%s' "$value" | vercel env add "$name" "$target" --force 2>/dev/null || \
      printf '%s' "$value" | vercel env add "$name" "$target"
  done
  echo "    set $name on production, preview, development"
}

echo "==> Pushing environment variables to Vercel"
add_env DATABASE_URL "$DATABASE_URL"
add_env VERCEL_ACCESS_TOKEN "$VERCEL_ACCESS_TOKEN"
add_env CRON_SECRET "$CRON_SECRET"

if [[ -n "${VERCEL_TEAM_ID:-}" ]]; then
  add_env VERCEL_TEAM_ID "$VERCEL_TEAM_ID"
else
  echo "    (VERCEL_TEAM_ID omitted — ingest uses account_id=personal)"
fi

if [[ -n "${REQUIRED_TAG_KEYS:-}" ]]; then
  add_env REQUIRED_TAG_KEYS "$REQUIRED_TAG_KEYS"
fi

echo ""
echo "==> Deploying to production"
vercel deploy --prod --yes

echo ""
echo "Done. Cron runs daily at 06:00 UTC (see vercel.json)."
echo "Manual ingest (replace URL and CRON_SECRET):"
echo '  curl -sS -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_APP.vercel.app/api/cron/ingest-vercel" | jq'
