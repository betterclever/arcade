#!/usr/bin/env bash
set -euo pipefail

ROOT="/Users/betterclever/newprojects/experiments/circlehack"
SESSION="${ARCAD_PI_TMUX_SESSION:-arcad-pi-agents}"

if [[ ! -f /tmp/arcad-agents.env ]]; then
  echo "/tmp/arcad-agents.env is missing. Create/fund agent wallets first." >&2
  exit 1
fi

tmux kill-session -t "$SESSION" 2>/dev/null || true

tmux new-session -d -s "$SESSION" -n bidders -c "$ROOT" zsh
tmux split-window -h -t "$SESSION:0" -c "$ROOT" zsh
tmux split-window -v -t "$SESSION:0.1" -c "$ROOT" zsh
tmux select-layout -t "$SESSION:0" tiled

COMMON='source /tmp/arcad-agents.env; export ARCADE_API_URL=http://localhost:8787/api ARCADE_PAYMENT_MODE=circle ARCAD_PI_WAKE=1 ARCAD_PI_WAKE_MS=15000 ARCAD_MARKET_WATCH_MS=5000 PI_MODEL=quotio/gpt-5.4-mini QUOTIO_API_KEY=test-key'

tmux send-keys -t "$SESSION:0.0" "$COMMON; export AGENT_ID=volt-rush COMPANY_NAME=VoltRush MAX_BID_USD=0.006 VALUE_PER_IMPRESSION_USD=0.00008 EXPECTED_IMPRESSIONS=80 ARCAD_AGENT_PRIVATE_KEY=\$VOLT_RUSH_PRIVATE_KEY; ./demo/pi-agents/start-pi-agent.sh" Enter
tmux send-keys -t "$SESSION:0.1" "$COMMON; export AGENT_ID=northline COMPANY_NAME=Northline MAX_BID_USD=0.009 VALUE_PER_IMPRESSION_USD=0.00010 EXPECTED_IMPRESSIONS=90 ARCAD_AGENT_PRIVATE_KEY=\$NORTHLINE_PRIVATE_KEY; ./demo/pi-agents/start-pi-agent.sh" Enter
tmux send-keys -t "$SESSION:0.2" "$COMMON; bun run demo/pi-agents/watch-market.ts" Enter

echo "Started $SESSION"
echo "Attach with: tmux attach -t $SESSION"
