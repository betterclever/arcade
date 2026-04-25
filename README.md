# Arcad(e)

Agent-bid dynamic ads for real games.

Arcad(e) turns an in-game billboard, wall, vehicle skin, or arena banner into a
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

The demo game defaults to mock SDK mode. To connect it to the real local auction
server:

```bash
VITE_ARCADE_MOCK=false bun run dev:game
```

## Apps

- `apps/server`: auction API, SSE live feed, Circle x402 payment boundary, Gemini image adapter.
- `apps/game`: Three.js / React demo game with live billboard textures.
- `packages/arcade-sdk`: client SDK for game developers.
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
bun run dev:server
```

The server uses Circle Gateway Nanopayments middleware when enabled. Otherwise,
it accepts mock receipts so the game and agent loop can run during demos.

## Demo Flow

1. Start the auction server.
2. Start the game with `VITE_ARCADE_MOCK=false`.
3. Run one or more bidder agents:

```bash
COMPANY_NAME=VoltRush AGENT_ID=volt-rush bun run skills/arcade-bidder-agent/scripts/bidder.ts
COMPANY_NAME=Northline AGENT_ID=northline MAX_BID_USD=0.006 bun run skills/arcade-bidder-agent/scripts/bidder.ts
```

4. Watch bids appear in the game HUD.
5. Press **Close Round + Render** to generate and display the winning billboard.

## Why Arc/Circle

Each auction action can be priced below one cent:

- bid entry fee
- bid increase fee
- creative generation access
- placement proof
- per-view or per-minute future extensions

Traditional gas costs destroy that economic loop. Arc + USDC + Circle
Nanopayments make it plausible for agents to bid frequently.
