#!/usr/bin/env bash
set -euo pipefail

ROOT="${ARCAD_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
SESSION="${ARCAD_PI_TMUX_SESSION:-arcad-pi-agents}"
TMUX_SHELL="${ARCAD_TMUX_SHELL:-${SHELL:-bash}}"
PI_MODEL_VALUE="${PI_MODEL:-quotio/gpt-5.4-mini}"
PI_WAKE_MS_VALUE="${ARCAD_PI_WAKE_MS:-15000}"
MARKET_WATCH_MS_VALUE="${ARCAD_MARKET_WATCH_MS:-5000}"
ROUND_DURATION_MS_VALUE="${DEMO_ROUND_DURATION_MS:-300000}"
CAMPAIGN_INTERVAL_MS_VALUE="${CAMPAIGN_MANAGER_INTERVAL_MS:-5000}"
MISSION_MAX_BID_VALUE="${MISSION_MAX_BID_USD:-0.05}"
SUTRO_MAX_BID_VALUE="${SUTRO_MAX_BID_USD:-0.075}"

if [[ ! -f /tmp/arcad-agents.env ]]; then
  echo "/tmp/arcad-agents.env is missing. Create/fund agent wallets first." >&2
  exit 1
fi

tmux kill-session -t "$SESSION" 2>/dev/null || true
pkill -f "demo/pi-agents/watch-market.ts" 2>/dev/null || true
pkill -f "^pi( |$)" 2>/dev/null || true
rm -f "$HOME/.pi/session-control/arcad-mission-control-ai.alias" \
      "$HOME/.pi/session-control/arcad-sutro-inference.alias" \
      "$HOME/.pi/session-control/arcad-volt-rush.alias" \
      "$HOME/.pi/session-control/arcad-northline.alias" \
      "$HOME/.pi/session-control"/*.sock 2>/dev/null || true
sleep 1

tmux new-session -d -s "$SESSION" -n control-room -c "$ROOT" "$TMUX_SHELL"
tmux split-window -h -p 36 -t "$SESSION:0" -c "$ROOT" "$TMUX_SHELL"
tmux split-window -v -p 66 -t "$SESSION:0.1" -c "$ROOT" "$TMUX_SHELL"
tmux split-window -v -p 50 -t "$SESSION:0.2" -c "$ROOT" "$TMUX_SHELL"

COMMON="source /tmp/arcad-agents.env; [[ -f /tmp/arcad-server.env ]] && source /tmp/arcad-server.env; [[ -f /tmp/arcad-pi-model.env ]] && source /tmp/arcad-pi-model.env; export ARCAD_ROOT='$ROOT' ARCADE_API_URL=http://localhost:8787/api ARCADE_PAYMENT_MODE=circle ARCAD_PI_WAKE=1 ARCAD_PI_WAKE_MS=$PI_WAKE_MS_VALUE ARCAD_MARKET_WATCH_MS=$MARKET_WATCH_MS_VALUE PI_MODEL='$PI_MODEL_VALUE' ARCAD_WATCH_AGENTS=mission-control-ai:arcad-mission-control-ai,sutro-inference:arcad-sutro-inference"

tmux send-keys -t "$SESSION:0.0" "$COMMON; export PAYMENT_MODE=circle SELLER_ADDRESS=0x5d6FA4C059d74d0Ac262ff643853491eA7820C17 X402_NETWORKS=eip155:5042002 CIRCLE_GATEWAY_FACILITATOR_URL=https://gateway-api-testnet.circle.com DEMO_ROUND_DURATION_MS=$ROUND_DURATION_MS_VALUE BID_AUTHORIZATION_TTL_MS=345600000 CAMPAIGN_MANAGER_ENABLED=true CAMPAIGN_MANAGER_INTERVAL_MS=$CAMPAIGN_INTERVAL_MS_VALUE MAX_BID_USD=0.10 PORT=8787; pm2 delete arcade-server >/dev/null 2>&1 || true; bun run demo/server-console.ts" Enter
tmux send-keys -t "$SESSION:0.1" "$COMMON; export AGENT_ID=mission-control-ai COMPANY_NAME='Mission Control AI' BRAND_CATEGORY='AI agent company' BRAND_PROFILE='Mission Control AI builds reliable autonomous GTM and ops agents for SF startups. Position it as a trustworthy agent workforce: fast setup, always-on execution, crisp dashboards, human-in-the-loop control.' MAX_BID_USD=$MISSION_MAX_BID_VALUE VALUE_PER_IMPRESSION_USD=0.00020 EXPECTED_IMPRESSIONS=250 ARCAD_AGENT_PRIVATE_KEY=\$VOLT_RUSH_PRIVATE_KEY; ./demo/pi-agents/start-pi-agent.sh" Enter
tmux send-keys -t "$SESSION:0.2" "$COMMON; export AGENT_ID=sutro-inference COMPANY_NAME='Sutro Inference' BRAND_CATEGORY='inference provider company' BRAND_PROFILE='Sutro Inference is an SF inference provider for low-latency multimodal AI. Sell blazing-fast GPU inference, predictable pricing, high uptime, and models served near users.' MAX_BID_USD=$SUTRO_MAX_BID_VALUE VALUE_PER_IMPRESSION_USD=0.00024 EXPECTED_IMPRESSIONS=300 ARCAD_AGENT_PRIVATE_KEY=\$NORTHLINE_PRIVATE_KEY; ./demo/pi-agents/start-pi-agent.sh" Enter
tmux send-keys -t "$SESSION:0.3" "$COMMON; bun run demo/pi-agents/watch-market.ts" Enter

echo "Started $SESSION"
echo "Attach with: tmux attach -t $SESSION"
