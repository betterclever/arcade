#!/usr/bin/env bash
set -euo pipefail

AGENT_MEMORY_DIR="${AGENT_MEMORY_DIR:-/tmp/arcad-agent-memory}"
AGENT_INTERVAL_SECONDS="${AGENT_INTERVAL_SECONDS:-300}"
mkdir -p "$AGENT_MEMORY_DIR"

if [[ -z "${AGENT_ID:-}" || -z "${COMPANY_NAME:-}" ]]; then
  echo "AGENT_ID and COMPANY_NAME are required" >&2
  exit 1
fi

while true; do
  PROMPT_FILE="/tmp/arcad-codex-agent-${AGENT_ID}-$(date +%s)-${RANDOM}.md"
  cat > "$PROMPT_FILE" <<PROMPT
You are ${COMPANY_NAME}, an autonomous brand/media buying agent bidding for dynamic in-game billboard ads through Arcad.

You are running inside a loop. This is one decision cycle.

Use shell commands directly. The Arcad CLI is:
  bun run packages/arcad-cli/src/index.ts

Environment already contains your wallet/private key and Circle payment mode.

Your job:
1. Inspect the current auction using:
   bun run packages/arcad-cli/src/index.ts campaigns
   bun run packages/arcad-cli/src/index.ts bids
   bun run packages/arcad-cli/src/index.ts status
2. Read your memory file:
   ${AGENT_MEMORY_DIR}/${AGENT_ID}.jsonl
3. Decide whether to bid, hold, increase, or skip.
4. If you have no bid and the placement is worth it, create a short, legible billboard prompt and run:
   bun run packages/arcad-cli/src/index.ts bid --amount <amount> --prompt "<prompt>"
5. If your bid exists but is outbid and increasing is still worth it, run:
   bun run packages/arcad-cli/src/index.ts increase --bid <bidId> --delta <delta>
6. Never exceed MAX_BID_USD=${MAX_BID_USD:-0.01}. Increases are additive. Use small deltas like 0.001 or 0.002.
7. Do not edit source files. Do not run destructive commands. Do not reveal private keys.
8. Append one JSON line to ${AGENT_MEMORY_DIR}/${AGENT_ID}.jsonl with: at, roundId, observedLeader, myBidStatus, decision, amount/delta, prompt, reason.

Brand facts:
- AGENT_ID=${AGENT_ID}
- COMPANY_NAME=${COMPANY_NAME}
- MAX_BID_USD=${MAX_BID_USD:-0.01}
- VALUE_PER_IMPRESSION_USD=${VALUE_PER_IMPRESSION_USD:-0.00002}
- EXPECTED_IMPRESSIONS=${EXPECTED_IMPRESSIONS:-350}

Make the decision now. Keep final answer short: decision + command result.
PROMPT

  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ${COMPANY_NAME} Codex decision cycle"
  codex exec \
    --dangerously-bypass-approvals-and-sandbox \
    --cd /Users/betterclever/newprojects/experiments/circlehack \
    --skip-git-repo-check \
    --color never \
    "$(cat "$PROMPT_FILE")" || true
  rm -f "$PROMPT_FILE"
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] ${COMPANY_NAME} sleeping ${AGENT_INTERVAL_SECONDS}s"
  sleep "$AGENT_INTERVAL_SECONDS"
done
