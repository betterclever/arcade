const apiUrl = process.env.ARCADE_API_URL ?? "http://localhost:8787/api";
const surfaceId = process.env.ARCADE_SURFACE_ID ?? "raceway-billboard-main";
const agentId = process.env.AGENT_ID ?? "volt-rush-agent";
const company = process.env.COMPANY_NAME ?? "VoltRush";
const maxBidUsd = Number(process.env.MAX_BID_USD ?? "0.01");
const valuePerImpressionUsd = Number(process.env.VALUE_PER_IMPRESSION_USD ?? "0.00002");
const expectedImpressions = Number(process.env.EXPECTED_IMPRESSIONS ?? "350");
const intervalMs = Number(process.env.BID_LOOP_MS ?? 5 * 60 * 1000);
const paymentMode = process.env.ARCADE_PAYMENT_MODE ?? "mock";

async function tick() {
  const quote = await postJson("/agents/quote", {
    surfaceId,
    agentId,
    company,
    maxBidUsd,
    valuePerImpressionUsd,
    expectedImpressions,
  });

  console.log(`[${new Date().toISOString()}] quote`, quote);
  if (!quote.shouldBid) return;

  const prompt = [
    `Create a premium in-game racing billboard for ${company}.`,
    "Use bold readable logo text, fast motion, and a single memorable product hero.",
    "The ad should feel native to a racing game and be legible from a moving car.",
  ].join(" ");

  const bid = await postJson(`/surfaces/${surfaceId}/bids`, {
    agentId,
    company,
    amountUsd: quote.suggestedBidUsd,
    prompt,
    rationale: quote.reason,
  });

  console.log("submitted bid", bid);
}

async function postJson(path: string, body: unknown) {
  if (paymentMode === "circle" && isPaidPath(path)) {
    const { GatewayClient } = await import("@circle-fin/x402-batching/client");
    const privateKey = process.env.ARCADE_BUYER_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error("ARCADE_BUYER_PRIVATE_KEY is required when ARCADE_PAYMENT_MODE=circle");
    }

    const client = new GatewayClient({
      chain: (process.env.ARCADE_CHAIN ?? "arcTestnet") as "arcTestnet",
      privateKey: privateKey as `0x${string}`,
      rpcUrl: process.env.ARCADE_RPC_URL,
    });

    const result = await client.pay(`${apiUrl}${path}`, {
      method: path.includes("/increase") ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    return result.data;
  }

  const response = await fetch(`${apiUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-arcade-payment-receipt": `mock-bidder-${crypto.randomUUID()}`,
      "x-arcade-agent-wallet": process.env.AGENT_WALLET ?? agentId,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function isPaidPath(path: string) {
  return path.includes("/bids");
}

await tick();
setInterval(() => {
  tick().catch((error) => console.error("bid loop failed", error));
}, intervalMs);
