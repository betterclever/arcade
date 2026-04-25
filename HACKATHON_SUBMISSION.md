# Arcad Hackathon Submission Draft

## One-liner

Arcad is an agent-native ad marketplace for games: autonomous brand agents bid in USDC for live in-game ad surfaces, and the winning prompt becomes a generated billboard texture streamed into the 3D game.

## Short Description

Arcad turns a game billboard, wall, vehicle skin, or arena banner into a live auction surface. Game developers register ad surfaces through the Arcad SDK. Brand agents use the Arcad CLI or bidder skill to price exposure, submit x402-paid bids, increase bids when they are outbid, and inspect payment receipts. At round close, the server picks the winning bid, generates ad creative with Gemini / Nano Banana Pro, and pushes the new texture into the running Three.js game.

The core idea is that agents should be able to buy media the same way software buys compute: programmatically, cheaply, frequently, and with verifiable payment records.

## Problem

Game advertising is still mostly static, manually sold, and too heavyweight for small placements or fast-moving campaigns. A billboard that might be valuable for the next five minutes of gameplay should not require a sales process, a creative upload workflow, and a large minimum spend.

Autonomous agents make this even more interesting. A brand agent can understand its budget, expected impressions, and audience context, then bid only when the economics clear. But that requires payment rails where sub-cent or low-cent actions make sense.

## Solution

Arcad provides:

- A real-time auction API for game ad surfaces.
- A game SDK that subscribes to bids and texture updates.
- An autonomous bidder CLI and reusable `arcad-bidder-agent` skill.
- Circle x402 / Gateway Nanopayments support for paid bid and bid-increase actions.
- Mock payment mode for local demos.
- A Three.js driving demo where the winning ad becomes a live roadside billboard.
- A minimal Arc proof contract for registering surfaces, recording bid events, bid increases, and finalized placements.

## What We Built

- `apps/server`: Express auction server with surfaces, bids, rounds, SSE events, payment ledger, x402 guards, and creative generation hook.
- `apps/game`: React + Three.js driving game with a live billboard, HUD, round state, bid history, winners, scene selection, car selection, and texture updates.
- `packages/arcade-sdk`: Game developer SDK for creating ad surfaces, subscribing to bids, subscribing to generated textures, and closing rounds.
- `packages/arcad-cli`: Buyer/operator CLI for wallets, faucet flow, Gateway deposit, bidding, bid increases, payment inspection, winners, refunds, and autonomous loops.
- `skills/arcade-bidder-agent`: Cross-harness agent skill for brand bidding behavior.
- `contracts`: `ArcadeAdAuction.sol`, a minimal Arc proof layer for surface registration, bid records, bid increases, and finalized placements.
- `demo/server-console.ts`: Terminal control room that shows live bids, x402 authorizations, round state, leader, payments, and server logs.

## Circle / Arc Usage

Arcad uses Circle Gateway Nanopayments through `@circle-fin/x402-batching`. In Circle mode, paid endpoints return x402 payment requirements. The buyer CLI uses `GatewayClient.pay(...)` to handle the challenge, sign a payment authorization, and retry the request.

Paid actions include:

- Bid entry fees.
- Bid increase fees.
- Future extensions such as creative generation access, placement proof, per-view fees, or per-minute placement fees.

The local demo logs show Circle x402 receipts for both initial bids and increases on Arc Testnet:

- Network: `eip155:5042002`.
- USDC asset: `0x3600000000000000000000000000000000000000`.
- Seller/pay-to address observed in receipts: `0x5d6FA4C059d74d0Ac262ff643853491eA7820C17`.
- Verified x402 payment authorizations included `verifyResult.isValid: true`.

## Demo Story Recovered From Logs

The live agent sessions simulated two autonomous advertisers bidding on `raceway-billboard-main`.

- VoltRush submitted a paid `$0.002` bid with the prompt: `VoltRush Nitro Charge, bold yellow logo, electric can, highway speed lines, minimal text`.
- Northline submitted a paid `$0.002` bid with the prompt: `Northline night-road logistics, bright wordmark, clean lane lines, move freight faster`.
- Because VoltRush was leading on the tie, Northline recorded the decision and increased its bid by `$0.001` to `$0.003`.
- The increase generated a Circle x402 receipt for `$0.001` and the bid became `leading`.
- A later VoltRush session observed that VoltRush was leading at `$0.004` and correctly held rather than spending more while already in first place.

This is the submission's strongest demo point: agents are not just calling an API once. They are watching a market, reasoning about budget and expected value, paying per action, and reacting to competition.

## Demo Script

1. Start the auction server:

```bash
bun run dev:server
```

2. Start the game connected to the real local auction server:

```bash
VITE_ARCADE_MOCK=false bun run dev:game
```

3. Start the control room:

```bash
bun run demo/server-console.ts
```

4. Run two bidder agents:

```bash
COMPANY_NAME=VoltRush AGENT_ID=volt-rush bun run packages/arcad-cli/src/index.ts loop
COMPANY_NAME=Northline AGENT_ID=northline MAX_BID_USD=0.006 bun run packages/arcad-cli/src/index.ts loop
```

5. Show bids appearing in the game HUD and control room.

6. Close the round and render the winner:

```bash
bun run packages/arcad-cli/src/index.ts operator close-round
```

7. Inspect the result:

```bash
bun run packages/arcad-cli/src/index.ts winner
bun run packages/arcad-cli/src/index.ts payments
bun run packages/arcad-cli/src/index.ts bids
```

## Suggested Video Narrative

Arcad makes game ad surfaces agent-biddable. Here is a driving game with a live billboard registered as `raceway-billboard-main`. Two brand agents, VoltRush and Northline, are watching the same surface. Each agent has a budget and expected value model. When the round opens, they submit paid bids through Circle x402. The control room shows the bids, the leader, and the payment authorizations. Northline sees it is outbid on a tie and increases by a tenth of a cent. The server verifies the x402 authorization, updates the market, and streams the state into the game. When the operator closes the round, Arcad generates the winning billboard creative and pushes it directly into the Three.js scene.

## Why It Matters

Arcad shows how game ads can become programmable markets. Developers get monetizable surfaces without custom sales ops. Brands get agent-driven media buying with real payment receipts. Players see contextual creative that can change round by round. Circle x402 makes the economics plausible because the actions can be priced below a cent without destroying the loop.

## Current Limitations

- The demo is local-first.
- Creative generation depends on configured Gemini / Nano Banana Pro credentials.
- The proof contract is minimal and not fully integrated into the server flow yet.
- Real production usage would need moderation, publisher controls, creative policy checks, attribution, and fraud controls.

## Submission Form Copy

Project name: Arcad

Tagline: Agent-bid dynamic ads for real games.

What it does: Arcad lets autonomous brand agents bid with USDC for live in-game ad surfaces. The winning prompt is rendered into billboard creative and streamed into a running game.

How we built it: React, Three.js, Express, Bun, Circle x402 / Gateway Nanopayments, an Arc proof contract, a game SDK, an operator CLI, and a reusable bidder-agent skill.

Best technical achievement: Two autonomous agents competed for the same game billboard, paid for bid actions through Circle x402, increased bids based on market state, and exposed verified payment receipts in the CLI/control room.

What's next: Integrate the Arc proof contract into every bid and placement, add policy checks for generated creative, support more game engines, and add per-view settlement.
