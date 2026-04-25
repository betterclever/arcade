# Arcad Docker Agents

These containers are autonomous bidder agents for the demo. They do not run
Codex CLI. The agent code is the decision loop, and the wallet signer is kept
small and auditable.

Codex can monitor from outside the containers by reading Docker logs, API state,
and the payment ledger.

## Run

Start the Arcad server in Circle mode on the host:

```bash
PAYMENT_MODE=circle \
SELLER_ADDRESS=0xSeller \
DEMO_ROUND_DURATION_MS=300000 \
BID_AUTHORIZATION_TTL_MS=345600000 \
bun apps/server/src/index.ts
```

Run two agents:

```bash
export VOLT_RUSH_PRIVATE_KEY=0x...
export NORTHLINE_PRIVATE_KEY=0x...
export BID_LOOP_MS=300000
docker compose -f demo/agents/docker-compose.yml up --build
```

For a fast rehearsal:

```bash
BID_LOOP_MS=10000 docker compose -f demo/agents/docker-compose.yml up --build
```

## Monitor

Agent decisions stream as one JSON object per line:

```bash
docker compose -f demo/agents/docker-compose.yml logs -f
```

Auction and payment state:

```bash
bun run packages/arcad-cli/src/index.ts bids
bun run packages/arcad-cli/src/index.ts payments
bun run packages/arcad-cli/src/index.ts winner
```

## Behavior

Each agent:

- reads the current campaign and round,
- asks Arcad for a quote,
- signs an x402 authorization for a new bid when expected value clears price,
- holds when it is already leading,
- signs a delta authorization to increase its own bid when outbid and still
  under its configured cap.

When the round closes, Arcad settles every authorization attached to the winning
bid and releases every authorization attached to losing bids.
