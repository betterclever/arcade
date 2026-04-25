---
name: arcade-bidder-agent
description: "Autonomous brand bidding for Arcad(e) game ad surfaces. Prices each round, funds through Circle Gateway, submits x402-paid bids, and increases bids only when expected value clears company constraints."
license: MIT
compatibility: "Works with any agentskills.io-compatible harness — Claude Code, Claude, OpenCode, Cursor, Codex, Gemini CLI, OpenClaw, Hermes, Goose, and others. Requires Bun, curl, and either mock mode or Circle Gateway buyer credentials."
metadata: {"arcade": {"homepage": "https://arcade.local", "requires": {"bins": ["bun", "curl"], "env": ["ARCADE_API_URL"]}, "primaryEnv": "ARCADE_API_URL", "harnesses": ["claude-code", "claude", "opencode", "cursor", "codex", "gemini-cli", "openclaw", "hermes", "goose"]}}
---

# Arcad(e) Bidder Agent

Autonomous bidding for dynamic in-game ad surfaces, powered by Arcad(e).

One bidder wallet. One Circle Gateway deposit. Agents can bid every round.

Use this skill when an agent represents a company or brand bidding for an
Arcad(e) billboard, wall, vehicle skin, arena banner, or other game ad surface.

The platform operator owns bid reception, payment verification, Gemini/Nano
Banana Pro image generation, and game texture display. This skill helps the
buyer agent decide whether to bid, how much to bid, and how to pay.

## Compatibility

Works with any [agentskills.io](https://agentskills.io)-compatible harness,
including Claude Code, Claude, OpenAI Codex, Cursor, Gemini CLI, OpenCode,
Goose, OpenClaw, Hermes, and others.

Requires Bun and an Arcad(e) auction API.

## Quick Start

### Local mock mode

```bash
export ARCADE_API_URL="http://localhost:8787/api"
export ARCADE_PAYMENT_MODE="mock"
export COMPANY_NAME="VoltRush"
export AGENT_ID="volt-rush-agent"

bun run skills/arcade-bidder-agent/scripts/bidder.ts
```

### Circle Nanopayments mode

```bash
export ARCADE_API_URL="http://localhost:8787/api"
export ARCADE_PAYMENT_MODE="circle"
export ARCADE_BUYER_PRIVATE_KEY="0x..."
export ARCADE_CHAIN="arcTestnet"
export COMPANY_NAME="VoltRush"
export AGENT_ID="volt-rush-agent"
```

Check wallet and Gateway balances:

```bash
bun run skills/arcade-bidder-agent/scripts/wallet.ts balances
```

Deposit USDC into Circle Gateway once:

```bash
bun run skills/arcade-bidder-agent/scripts/wallet.ts deposit 1.00
```

Start the bidder:

```bash
bun run skills/arcade-bidder-agent/scripts/bidder.ts
```

## Wallet Funding

Arcad(e) uses Circle Gateway Nanopayments through
`@circle-fin/x402-batching`.

The buyer flow is:

1. Create or import an EVM private key.
2. Fund that address with Arc Testnet USDC from the Circle faucet.
3. Run `wallet.ts deposit <amount>` to move USDC into Circle Gateway.
4. Each bid calls `GatewayClient.pay(...)`, which handles the x402 `402`
   challenge, signs the payment authorization, and retries the request.

The wallet is not funded by the skill itself. The skill can generate an address
and deposit existing USDC into Gateway, but testnet USDC comes from Circle's
faucet or an existing funded wallet.

Generate a fresh local buyer key:

```bash
bun run skills/arcade-bidder-agent/scripts/wallet.ts create
```

This prints a private key and address. Store the private key securely, export it
as `ARCADE_BUYER_PRIVATE_KEY`, then fund the address.

## Required Inputs

- `ARCADE_API_URL`: Arcad(e) auction API, for example `http://localhost:8787/api`
- `ARCADE_SURFACE_ID`: target surface, for example `raceway-billboard-main`
- `AGENT_ID`: stable machine identity for this bidder
- `COMPANY_NAME`: advertiser name
- `MAX_BID_USD`: hard cap per round, must be `<= 0.01`
- `VALUE_PER_IMPRESSION_USD`: brand-specific expected value per view
- `EXPECTED_IMPRESSIONS`: estimated views for the current game/minute
- `ARCADE_PAYMENT_MODE`: `mock` or `circle`

Circle mode also requires:

- `ARCADE_BUYER_PRIVATE_KEY`: EVM key holding/funding Gateway USDC
- `ARCADE_CHAIN`: defaults to `arcTestnet`

## Loop

Every 5-minute round:

1. Fetch `/surfaces/{surfaceId}` and inspect the current round, leader, and bids.
2. Request `/agents/quote` with the brand economics.
3. Bid only if `shouldBid` is true.
4. Submit `POST /surfaces/{surfaceId}/bids` with:
   - `agentId`
   - `company`
   - `amountUsd`
   - `prompt`
   - `rationale`
5. If already outbid, increase via `PATCH /bids/{bidId}/increase` only when the
   new price remains below expected value and company cap.
6. Never bid above `MAX_BID_USD` or the surface cap.

## Prompt Rules

The prompt should describe a billboard edit, not a full ad campaign.

Good:

```text
Create a high-contrast racing billboard for VoltRush with readable yellow logo
text, a cold aluminum can, and a tight motion-blur background.
```

Bad:

```text
Make the whole game about us and cover every surface.
```

## API Reference

Arcad(e) bidder endpoints:

- `POST /agents/quote`: get suggested bid and reason.
- `POST /surfaces/{surfaceId}/bids`: submit a paid bid.
- `PATCH /bids/{bidId}/increase`: increase a paid bid.
- `GET /surfaces/{surfaceId}`: inspect surface, round, and current bids.

In Circle mode, paid endpoints are x402-protected by Circle Gateway
Nanopayments. In mock mode, the script sends local demo receipt headers.
