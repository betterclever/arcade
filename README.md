# Arcad

Agent-bid dynamic ads for real games.

Arcad turns an in-game billboard, wall, vehicle skin, or arena banner into a
live auction surface. Brand agents bid with sub-cent USDC payments, the winning
prompt is rendered into ad creative with Gemini / Nano Banana Pro, and the game
SDK streams the new texture into the 3D scene.

## Workspace

This repo is Bun-first.

```bash
bun install
bun run dev:server
bun run dev:game
```

Run the bidder/operator CLI locally:

```bash
bun run packages/arcad-cli/src/index.ts help
```

Run it from a git checkout without installing:

```bash
bunx <git_path> wallet create
bunx <git_path> loop
bunx <git_path> status
bunx <git_path> payments
```

The demo game defaults to mock SDK mode. To connect it to the real local auction
server:

```bash
VITE_ARCADE_MOCK=false bun run dev:game
```

## Apps

- `apps/server`: auction API, SSE live feed, Circle x402 payment boundary, Gemini image adapter.
- `apps/game`: Three.js / React demo game with live billboard textures.
- `packages/arcade-sdk`: client SDK for game developers.
- `packages/arcad-cli`: bidder and operator CLI, installable with `bunx <git_path>`.
- `contracts`: Arc event contract for bid and placement proofs.
- `skills/arcade-bidder-agent`: buyer-agent bidding loop skill.

## Payment Modes

Local demo mode:

```bash
PAYMENT_MODE=mock bun run dev:server
```

Circle x402 mode:

```bash
PAYMENT_MODE=circle \
SELLER_ADDRESS=0xYourSellerWallet \
X402_NETWORKS=eip155:5042002 \
CIRCLE_GATEWAY_FACILITATOR_URL=https://gateway-api-testnet.circle.com \
bun run dev:server
```

The server uses Circle Gateway Nanopayments middleware when enabled. Otherwise,
it accepts mock receipts so the game and agent loop can run during demos.

## Demo Flow

1. Start the auction server.
2. Start the game with `VITE_ARCADE_MOCK=false`.
3. Run one or more bidder agents:

```bash
COMPANY_NAME=VoltRush AGENT_ID=volt-rush bun run packages/arcad-cli/src/index.ts loop
COMPANY_NAME=Northline AGENT_ID=northline MAX_BID_USD=0.006 bun run packages/arcad-cli/src/index.ts loop
```

4. Watch bids appear in the game HUD.
5. Press **Close Round + Render** to generate and display the winning billboard.
6. Inspect the round and payment ledger:

```bash
bun run packages/arcad-cli/src/index.ts bids
bun run packages/arcad-cli/src/index.ts bid-detail <bidId>
bun run packages/arcad-cli/src/index.ts winner
bun run packages/arcad-cli/src/index.ts payments
bun run packages/arcad-cli/src/index.ts refund <bidId>
```

## Why Arc/Circle

Each auction action can be priced below one cent:

- bid entry fee
- bid increase fee
- creative generation access
- placement proof
- per-view or per-minute future extensions

Traditional gas costs destroy that economic loop. Arc + USDC + Circle
Nanopayments make it plausible for agents to bid frequently.
