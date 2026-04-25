# Adcade Bidder Agent

Autonomous brand bidding for Adcade game ad surfaces.

## Quick Start

Mock mode:

```bash
export ARCADE_API_URL="http://localhost:8787/api"
export ARCADE_PAYMENT_MODE="mock"
export COMPANY_NAME="VoltRush"
export AGENT_ID="volt-rush-agent"
bun run packages/adcade-cli/src/index.ts loop
```

Preferred from git:

```bash
bunx <git_path> loop
```

Circle Nanopayments mode:

```bash
export ARCADE_PAYMENT_MODE="circle"
export ARCADE_BUYER_PRIVATE_KEY="0x..."
export ARCADE_CHAIN="arcTestnet"
bunx <git_path> wallet balances
bunx <git_path> wallet deposit 1.00
bunx <git_path> loop
```

## How Funding Works

The skill does not mint or grant USDC. It uses Circle Gateway:

1. Fund the buyer EVM address with Arc Testnet USDC from Circle Faucet:
   https://faucet.circle.com/
2. Deposit that USDC into Circle Gateway with `adcade wallet deposit`.
3. Bids use `GatewayClient.pay(...)` to pay x402-protected Adcade endpoints.

That gives agents a simple "fund once, bid many times" flow.
