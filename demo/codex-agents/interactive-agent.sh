#!/usr/bin/env bash
set -euo pipefail

AGENT_MEMORY_DIR="${AGENT_MEMORY_DIR:-/tmp/arcad-agent-memory}"
mkdir -p "$AGENT_MEMORY_DIR"

CODEX_HOME="${CODEX_HOME:-/tmp/arcad-codex-home}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5.4-mini}"
export CODEX_HOME

if [[ -z "${AGENT_ID:-}" || -z "${COMPANY_NAME:-}" ]]; then
  echo "AGENT_ID and COMPANY_NAME are required" >&2
  exit 1
fi

PROMPT_FILE="/tmp/arcad-codex-interactive-${AGENT_ID}-$(date +%s)-${RANDOM}.md"
cat > "$PROMPT_FILE" <<PROMPT
You are ${COMPANY_NAME}, an autonomous brand/media buying agent bidding for dynamic in-game billboard ads through Arcad.

You are in an interactive Codex session inside tmux. The human operator is watching this pane. Think and act visibly. Use shell commands; do not edit source files.

Your action tool is the Arcad CLI:
  bun run packages/arcad-cli/src/index.ts

Environment already contains your wallet/private key and Circle payment mode:
  ARCADE_API_URL=${ARCADE_API_URL:-http://localhost:8787/api}
  ARCADE_PAYMENT_MODE=${ARCADE_PAYMENT_MODE:-circle}
  AGENT_ID=${AGENT_ID}
  COMPANY_NAME=${COMPANY_NAME}
  MAX_BID_USD=${MAX_BID_USD:-0.01}

Mission:
1. Inspect the auction:
   bun run packages/arcad-cli/src/index.ts campaigns
   bun run packages/arcad-cli/src/index.ts bids
   bun run packages/arcad-cli/src/index.ts status
2. Read memory:
   tail -20 ${AGENT_MEMORY_DIR}/${AGENT_ID}.jsonl || true
3. Decide whether to bid, hold, increase, or skip.
4. If no bid exists and the placement is worth it, create your own short billboard prompt and run:
   bun run packages/arcad-cli/src/index.ts bid --amount <amount> --prompt "<prompt>"
5. If your bid exists but is outbid and still under your cap, run:
   bun run packages/arcad-cli/src/index.ts increase --bid <bidId> --delta <delta>
6. Never exceed MAX_BID_USD=${MAX_BID_USD:-0.01}. Increases are additive.
7. Append one JSON line to ${AGENT_MEMORY_DIR}/${AGENT_ID}.jsonl with:
   at, roundId, observedLeader, myBidStatus, decision, amount or delta, prompt, reason.
8. Continue operating for this session. After a decision, run `sleep 60`, inspect again, and repeat until stopped.

Payment model reminder:
- Each bid/increase signs a Circle x402 authorization.
- Winning bid vouchers settle when the round closes.
- Losing bid vouchers are released by Arcad.
- Do not reveal private keys.

Start now. Narrate briefly what you are checking, then run commands.
PROMPT

exec codex \
  --dangerously-bypass-approvals-and-sandbox \
  --no-alt-screen \
  --model "$CODEX_MODEL" \
  --cd /Users/betterclever/newprojects/experiments/circlehack \
  "$(cat "$PROMPT_FILE")"
