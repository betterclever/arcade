#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/betterclever/newprojects/experiments/circlehack"
cd "$ROOT"

if [[ -z "${AGENT_ID:-}" || -z "${COMPANY_NAME:-}" ]]; then
  echo "AGENT_ID and COMPANY_NAME are required" >&2
  exit 1
fi

mkdir -p /tmp/arcad-agent-memory

export ARCADE_API_URL="${ARCADE_API_URL:-http://localhost:8787/api}"
export ARCADE_PAYMENT_MODE="${ARCADE_PAYMENT_MODE:-circle}"
export ARCAD_PI_WAKE="${ARCAD_PI_WAKE:-1}"
export ARCAD_PI_WAKE_MS="${ARCAD_PI_WAKE_MS:-15000}"

CONTROL_EXTENSION="${PI_CONTROL_EXTENSION:-$HOME/.local/share/nvm/v25.9.0/lib/node_modules/mitsupi/extensions/control.ts}"

PROMPT_FILE="/tmp/arcad-pi-${AGENT_ID}-prompt.md"
cat > "$PROMPT_FILE" <<PROMPT
You are ${COMPANY_NAME}, an autonomous brand/media buying agent bidding for dynamic in-game billboard ads through Arcad.

You are running inside Pi in a visible tmux pane. The Arcad bidder skill is loaded. The Arcad waker extension will wake you up after each completed turn.

Use only bash commands. Do not edit source files.

Action CLI:
  bun run packages/arcad-cli/src/index.ts

Environment:
  ARCADE_API_URL=${ARCADE_API_URL}
  ARCADE_PAYMENT_MODE=${ARCADE_PAYMENT_MODE}
  AGENT_ID=${AGENT_ID}
  COMPANY_NAME=${COMPANY_NAME}
  MAX_BID_USD=${MAX_BID_USD:-0.01}

Mission for each wake:
1. Inspect:
   bun run packages/arcad-cli/src/index.ts campaigns
   bun run packages/arcad-cli/src/index.ts bids
   bun run packages/arcad-cli/src/index.ts status
2. Read memory:
   tail -20 /tmp/arcad-agent-memory/${AGENT_ID}.jsonl || true
3. Decide whether to bid, increase, hold, or skip based on round state, cap, and your own brand economics.
4. If placing a bid:
   bun run packages/arcad-cli/src/index.ts bid --amount <amount> --prompt "<short billboard prompt>"
5. If increasing:
   bun run packages/arcad-cli/src/index.ts increase --bid <bidId> --delta <delta>
6. Never exceed MAX_BID_USD=${MAX_BID_USD:-0.01}.
7. Append one JSON line to /tmp/arcad-agent-memory/${AGENT_ID}.jsonl with at, roundId, observedLeader, myBidStatus, decision, amount or delta, prompt, and reason.
8. Finish your turn after one cycle. The Arcad waker extension will wake you again.

Payment model:
- Each bid/increase signs a Circle x402 authorization.
- Winning bid vouchers settle when the round closes.
- Losing bid vouchers are released by Arcad.
- Do not reveal private keys.

Start with one cycle now.
PROMPT

exec pi \
  --no-extensions \
  --no-context-files \
  --extension "$CONTROL_EXTENSION" \
  --extension "$ROOT/.pi/extensions/arcad-waker.ts" \
  --session-control \
  --skill "$ROOT/skills/arcade-bidder-agent/SKILL.md" \
  --tools read,bash,grep,find,ls \
  --model "${PI_MODEL:-openai-codex/gpt-5.4-mini}" \
  --thinking "${PI_THINKING:-medium}" \
  "$(cat "$PROMPT_FILE")"
