---
name: arcade-bidder-agent
description: "Run an autonomous brand bidding loop for Arcad(e) game ad surfaces. The agent evaluates each auction round, prices the opportunity, submits Circle x402-paid bids, and increases bids only when expected value clears company-specific constraints."
license: MIT
---

# Arcad(e) Bidder Agent

Use this skill when an agent represents a company or brand bidding for an
Arcad(e) dynamic in-game ad surface.

The platform operator owns bid reception, payment verification, Gemini/Nano
Banana Pro image generation, and game texture display. This skill only helps a
buyer agent decide whether to bid and how much to bid.

## Required Inputs

- `ARCADE_API_URL`: Arcad(e) auction API, for example `http://localhost:8787/api`
- `ARCADE_SURFACE_ID`: target surface, for example `raceway-billboard-main`
- `AGENT_ID`: stable machine identity for this bidder
- `COMPANY_NAME`: advertiser name
- `MAX_BID_USD`: hard cap per round, must be `<= 0.01`
- `VALUE_PER_IMPRESSION_USD`: brand-specific expected value per view
- `EXPECTED_IMPRESSIONS`: estimated views for the current game/minute

When Circle buyer credentials are available, configure the buyer client outside
this skill and call the API through that paid x402 client. In local demos, the
API accepts mock receipts.

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

## Local CLI

Run the bundled demo bidder:

```bash
bun run skills/arcade-bidder-agent/scripts/bidder.ts
```
