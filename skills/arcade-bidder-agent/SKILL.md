---
name: arcad-bidder-agent
description: "Autonomous brand bidding for Arcad game ad surfaces. Prices each round, funds through Circle Gateway, submits x402-paid bids, and increases bids only when expected value clears company constraints."
license: MIT
compatibility: "Works with any agentskills.io-compatible harness — Claude Code, Claude, OpenCode, Cursor, Codex, Gemini CLI, OpenClaw, Hermes, Goose, and others. Requires Bun, curl, and either mock mode or Circle Gateway buyer credentials."
metadata: {"arcad": {"homepage": "https://arcad.local", "requires": {"bins": ["bun", "curl"], "env": ["ARCADE_API_URL"]}, "primaryEnv": "ARCADE_API_URL", "harnesses": ["claude-code", "claude", "opencode", "cursor", "codex", "gemini-cli", "openclaw", "hermes", "goose"]}}
---

# Arcad Bidder Agent

Autonomous bidding for dynamic in-game ad surfaces, powered by Arcad.

One bidder wallet. One Circle Gateway deposit. Agents can bid every round.

Use this skill when an agent represents a company or brand bidding for an
Arcad billboard, wall, vehicle skin, arena banner, or other game ad surface.

The platform operator owns bid reception, payment verification, Gemini/Nano
Banana Pro image generation, and game texture display. This skill helps the
buyer agent decide whether to bid, how much to bid, and how to pay.

## Compatibility

Works with any [agentskills.io](https://agentskills.io)-compatible harness,
including Claude Code, Claude, OpenAI Codex, Cursor, Gemini CLI, OpenCode,
Goose, OpenClaw, Hermes, and others.

Requires Bun, the Arcad CLI, and an Arcad auction API.

## Quick Start

### Local mock mode

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

### Circle Nanopayments mode

```bash
export ARCADE_API_URL="http://localhost:8787/api"
export ARCADE_PAYMENT_MODE="circle"
export ARCAD_WALLET_PASSWORD="demo-password"
export ARCADE_CHAIN="arcTestnet"
export COMPANY_NAME="VoltRush"
export AGENT_ID="volt-rush-agent"
bunx <git_path> wallet new volt-rush
```

Check wallet and Gateway balances:

```bash
bunx <git_path> wallet balances
```

Open the Circle Faucet for the active wallet:

```bash
bunx <git_path> faucet
```

Deposit USDC into Circle Gateway once:

```bash
bunx <git_path> wallet deposit 1.00
```

Start the bidder:

```bash
bunx <git_path> loop
```

Inspect current auction state:

```bash
bunx <git_path> games
bunx <git_path> campaigns
bunx <git_path> status
bunx <git_path> bids
bunx <git_path> bid-detail <bidId>
bunx <git_path> winner
bunx <git_path> payments
bunx <git_path> refund <bidId>
```

## Wallet Funding

Arcad uses Circle Gateway Nanopayments through
`@circle-fin/x402-batching`.

The buyer flow is:

1. Create or import an EVM private key.
2. Fund that address with Arc Testnet USDC from the Circle Faucet:
   `https://faucet.circle.com/`
3. Run `arcad wallet deposit <amount>` to move USDC into Circle Gateway.
4. Each bid calls `GatewayClient.pay(...)`, which handles the x402 `402`
   challenge, signs the payment authorization, and retries the request.

The wallet is not funded by the skill itself. The skill can generate an address
and deposit existing USDC into Gateway, but testnet USDC comes from Circle's
faucet or an existing funded wallet.

Generate a fresh local buyer key:

```bash
bun run packages/arcad-cli/src/index.ts wallet new volt-rush
```

Or from git:

```bash
bunx <git_path> wallet new volt-rush
```

This stores an encrypted Foundry keystore under `~/.arcad/keystores`, selects it
as the active Arcad wallet, and prints the address. Use `ARCAD_WALLET_PASSWORD`
for non-interactive agent runs.

In the faucet UI, choose Arc Testnet, choose USDC, paste the generated address,
and request funds. Arc uses USDC for gas, and its ERC-20 USDC interface also
uses the same native USDC balance.

Use `arcad faucet` to open the Circle Faucet page, print the active wallet
address, and copy the address to the clipboard when the host supports it.

## Required Inputs

- `ARCADE_API_URL`: Arcad auction API, for example `http://localhost:8787/api`
- `ARCADE_SURFACE_ID`: target surface, for example `raceway-billboard-main`
- `AGENT_ID`: stable machine identity for this bidder
- `COMPANY_NAME`: advertiser name
- `MAX_BID_USD`: hard cap per round, must be `<= 0.01`
- `VALUE_PER_IMPRESSION_USD`: brand-specific expected value per view
- `EXPECTED_IMPRESSIONS`: estimated views for the current game/minute
- `ARCADE_PAYMENT_MODE`: `mock` or `circle`

Circle mode also requires:

- An active Arcad wallet: `arcad wallet new <name>` or `arcad wallet import <name> --private-key 0x...`
- `ARCAD_WALLET_PASSWORD`: password used to decrypt the active wallet
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
7. Use `status`, `bids`, `winner`, and `payments` to inspect the current round,
   last winner, payment receipts, transaction ids when Circle supplies them,
   and refund status.
8. Use `games` and `campaigns` to discover available game ad surfaces and the
   currently open auction rounds before choosing where to bid.

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

Arcad bidder endpoints:

- `POST /agents/quote`: get suggested bid and reason.
- `POST /surfaces/{surfaceId}/bids`: submit a paid bid.
- `PATCH /bids/{bidId}/increase`: increase a paid bid.
- `GET /surfaces/{surfaceId}`: inspect surface, round, and current bids.
- `GET /games`: list games and their ad surfaces.
- `GET /campaigns`: list current/upcoming ad campaigns and leading bids.
- `GET /surfaces/{surfaceId}/payments`: inspect payment receipts, transaction ids, and refund status.
- `GET /surfaces/{surfaceId}/rounds`: inspect round history.
- `GET /rounds/{roundId}`: inspect a specific round, winner, bids, and payments.
- `GET /bids/{bidId}`: inspect one bid, its payments, and refund status.
- `GET /bids/{bidId}/refund`: inspect refund status for a bid.

In Circle mode, paid endpoints are x402-protected by Circle Gateway
Nanopayments. In mock mode, the script sends local demo receipt headers.

Arcad bid entry and increase fees are participation fees, not escrowed bid
principal, so losing bids are recorded as `refundStatus: "not_refundable"`.
