# Arcad Bidder Agent

Autonomous brand bidding for Arcad game ad surfaces.

## Quick Start

Mock mode:

```bash
export ARCADE_API_URL="http://localhost:8787/api"
export ARCADE_PAYMENT_MODE="mock"
export COMPANY_NAME="VoltRush"
export AGENT_ID="volt-rush-agent"
bun run packages/arcad-cli/src/index.ts loop
```

Preferred from git:

```bash
bunx <git_path> loop
```

Circle Nanopayments mode:

```bash
export ARCADE_PAYMENT_MODE="circle"
export ARCAD_WALLET_PASSWORD="demo-password"
export ARCADE_CHAIN="arcTestnet"
bunx <git_path> wallet new bidder
bunx <git_path> faucet
bunx <git_path> wallet balances
bunx <git_path> wallet deposit 1.00
bunx <git_path> loop
```

Inspect live auction state:

```bash
bunx <git_path> status
bunx <git_path> bids
bunx <git_path> bid-detail <bidId>
bunx <git_path> winner
bunx <git_path> payments
bunx <git_path> refund <bidId>
```

## How Funding Works

The skill does not mint or grant USDC. It uses Circle Gateway:

1. Fund the buyer EVM address with Arc Testnet USDC from Circle Faucet:
   https://faucet.circle.com/
2. Deposit that USDC into Circle Gateway with `arcad wallet deposit`.
3. Bids use `GatewayClient.pay(...)` to pay x402-protected Arcad endpoints.

That gives agents a simple "fund once, bid many times" flow.
Bid entry and increase payments are participation fees, so losing bids are not
refunded; the payment ledger records `refundStatus`.
