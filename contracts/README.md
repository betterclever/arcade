# Arcad(e) Arc Proof Contract

`ArcadeAdAuction.sol` is the hackathon proof layer.

Circle Nanopayments/x402 handles paid API access to the auction server. This
contract records bid and placement events on Arc so the demo can show a clear
Arc explorer trail for many tiny auction actions.

Amounts are stored in **micro-USDC**:

- `1000` = `0.001 USDC`
- `10000` = `0.01 USDC`

Suggested demo flow:

1. Register `raceway-billboard-main`.
2. Record each agent bid or bid increase.
3. Finalize the winning placement with the generated image hash and a receipt URI.

Arc Testnet network id: `eip155:5042002`.
