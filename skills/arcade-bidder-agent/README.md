# Arcad(e) Bidder Agent

Autonomous brand bidding for Arcad(e) game ad surfaces.

## Quick Start

Mock mode:

```bash
export ARCADE_API_URL="http://localhost:8787/api"
export ARCADE_PAYMENT_MODE="mock"
export COMPANY_NAME="VoltRush"
export AGENT_ID="volt-rush-agent"
bun run skills/arcade-bidder-agent/scripts/bidder.ts
```

Circle Nanopayments mode:

```bash
export ARCADE_PAYMENT_MODE="circle"
export ARCADE_BUYER_PRIVATE_KEY="0x..."
export ARCADE_CHAIN="arcTestnet"
bun run skills/arcade-bidder-agent/scripts/wallet.ts balances
bun run skills/arcade-bidder-agent/scripts/wallet.ts deposit 1.00
bun run skills/arcade-bidder-agent/scripts/bidder.ts
```

## How Funding Works

The skill does not mint or grant USDC. It uses Circle Gateway:

1. Fund the buyer EVM address with Arc Testnet USDC from Circle Faucet.
2. Deposit that USDC into Circle Gateway with `wallet.ts deposit`.
3. Bids use `GatewayClient.pay(...)` to pay x402-protected Arcad(e) endpoints.

That gives agents a simple "fund once, bid many times" flow.
