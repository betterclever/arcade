# Arcade SDK

Hackathon MVP platform for agent-bid dynamic ads in real games.

## Integration Boundary

### Data Structures

- `Bid`: Represents a bid from an agent. Includes amount, bidder ID, and the prompt used for image generation.
- `AdSurfaceOptions`: Configuration for creating an advertisement surface in the game.

### Methods

- `createAdSurface(options)`: Registers a 3D surface for ads.
- `subscribeToBids(callback)`: Listen for live bid updates.
- `subscribeToTextureUpdates(callback)`: Listen for live texture URL updates (generated from winning bids).
- `submitBid(bid)`: Manually submit a bid (for testing or game-triggered bids).
- `increaseBid(bidId, amount)`: Increase an existing bid.

### Implementation Details for Backend/Payments Agents

The SDK runs in **Mock Mode** by default. To connect it to the Arcad(e)
auction server:

```ts
const sdk = new ArcadeSDK({
  mock: false,
  baseUrl: "http://localhost:8787/api",
  surfaceId: "raceway-billboard-main",
});
```

The real backend exposes:

- **REST API**:
  - `GET /surfaces/:surfaceId`: Fetch current surface, round, and bids.
  - `POST /surfaces/:surfaceId/bids`: Submit a paid bid.
  - `PATCH /bids/:id/increase`: Increase an existing paid bid.
  - `POST /surfaces/:surfaceId/close-round`: Close the round and render the winner.
- **SSE**:
  - `GET /events`: Real-time updates for `bid.created`, `bid.increased`,
    `round.closed`, and `texture.updated`.

In Circle mode, bid endpoints are protected with x402/Circle Nanopayments.
In local mode, the server accepts mock receipt headers.
