#!/usr/bin/env bash
set -euo pipefail

ROUNDS="${ROUNDS:-12}"
API_URL="${ARCADE_API_URL:-http://localhost:8787/api}"

for round in $(seq 1 "$ROUNDS"); do
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] operator watching campaign $round/$ROUNDS"
  ends_at="$(bun run packages/arcad-cli/src/index.ts campaigns --api-url "$API_URL" | jq -r '.campaigns[0].endsAt')"
  now_ms="$(node -e 'console.log(Date.now())')"
  sleep_seconds="$(( (ends_at - now_ms) / 1000 ))"
  if [ "$sleep_seconds" -gt 0 ]; then
    sleep "$sleep_seconds"
  fi
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] closing campaign $round/$ROUNDS"
  bun run packages/arcad-cli/src/index.ts operator close-round --api-url "$API_URL" || true
done
