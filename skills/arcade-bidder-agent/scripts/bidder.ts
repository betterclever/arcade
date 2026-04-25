const apiUrl = process.env.ARCADE_API_URL ?? "http://localhost:8787/api";
const surfaceId = process.env.ARCADE_SURFACE_ID ?? "raceway-billboard-main";
const agentId = process.env.AGENT_ID ?? "volt-rush-agent";
const company = process.env.COMPANY_NAME ?? "VoltRush";
const maxBidUsd = Number(process.env.MAX_BID_USD ?? "0.01");
const valuePerImpressionUsd = Number(process.env.VALUE_PER_IMPRESSION_USD ?? "0.00002");
const expectedImpressions = Number(process.env.EXPECTED_IMPRESSIONS ?? "350");
const intervalMs = Number(process.env.BID_LOOP_MS ?? 5 * 60 * 1000);

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

await tick();
setInterval(() => {
  tick().catch((error) => console.error("bid loop failed", error));
}, intervalMs);
