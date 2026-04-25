#!/usr/bin/env bun
import { GatewayClient } from "@circle-fin/x402-batching/client";

type HttpMethod = "POST" | "PATCH";

interface Bid {
  id: string;
  amountUsd: number;
  agentId: string;
  company: string;
  status: string;
}

interface SurfaceSnapshot {
  round?: {
    id: string;
    status: string;
    endsAt: number;
  };
  bids?: Bid[];
}

interface Quote {
  shouldBid: boolean;
  suggestedBidUsd: number;
  reason: string;
  currentLeader?: Bid;
}

const config = {
  apiUrl: stripTrailingSlash(process.env.ARCADE_API_URL ?? "http://host.docker.internal:8787/api"),
  surfaceId: process.env.ARCADE_SURFACE_ID ?? "raceway-billboard-main",
  paymentMode: process.env.ARCADE_PAYMENT_MODE ?? "circle",
  privateKey: process.env.ARCAD_AGENT_PRIVATE_KEY,
  agentId: process.env.AGENT_ID ?? "demo-agent",
  company: process.env.COMPANY_NAME ?? "DemoCo",
  maxBidUsd: Number(process.env.MAX_BID_USD ?? "0.01"),
  valuePerImpressionUsd: Number(process.env.VALUE_PER_IMPRESSION_USD ?? "0.00002"),
  expectedImpressions: Number(process.env.EXPECTED_IMPRESSIONS ?? "350"),
  intervalMs: Number(process.env.BID_LOOP_MS ?? String(5 * 60 * 1000)),
  bidStepUsd: Number(process.env.BID_STEP_USD ?? "0.001"),
  prompt: process.env.AGENT_PROMPT ?? "",
  chain: process.env.ARCADE_CHAIN ?? "arcTestnet",
  rpcUrl: process.env.ARCADE_RPC_URL,
};

if (config.paymentMode === "circle" && !config.privateKey) {
  throw new Error("ARCAD_AGENT_PRIVATE_KEY is required in Circle mode");
}

const gateway = config.paymentMode === "circle"
  ? new GatewayClient({
    chain: config.chain as any,
    privateKey: config.privateKey as `0x${string}`,
    rpcUrl: config.rpcUrl,
  })
  : null;

await main();

async function main() {
  log("boot", {
    apiUrl: config.apiUrl,
    surfaceId: config.surfaceId,
    company: config.company,
    agentId: config.agentId,
    maxBidUsd: config.maxBidUsd,
    intervalMs: config.intervalMs,
    wallet: gateway?.address ?? "mock",
  });

  await tick();
  setInterval(() => {
    tick().catch((error) => log("error", { message: error.message }));
  }, config.intervalMs);
}

async function tick() {
  const snapshot = await getJson<SurfaceSnapshot>(`/surfaces/${config.surfaceId}`);
  const round = snapshot.round;
  if (!round || round.status !== "open") {
    log("skip", { reason: "no open round", round });
    return;
  }

  const quote = await postFree<Quote>("/agents/quote", {
    surfaceId: config.surfaceId,
    agentId: config.agentId,
    company: config.company,
    maxBidUsd: config.maxBidUsd,
    valuePerImpressionUsd: config.valuePerImpressionUsd,
    expectedImpressions: config.expectedImpressions,
  });

  const ownBid = findOwnBid(snapshot.bids ?? []);
  const leader = snapshot.bids?.[0];
  const targetUsd = priceTarget(quote, leader);

  if (!ownBid) {
    if (!quote.shouldBid || targetUsd > config.maxBidUsd) {
      log("skip", { reason: quote.reason, targetUsd, quote });
      return;
    }
    const response = await paidJson("POST", `/surfaces/${config.surfaceId}/bids`, {
      agentId: config.agentId,
      company: config.company,
      amountUsd: targetUsd,
      prompt: config.prompt || defaultPrompt(config.company),
      rationale: quote.reason,
    });
    log("bid", { targetUsd, response });
    return;
  }

  if (ownBid.status === "leading" || ownBid.id === leader?.id) {
    log("hold", { reason: "already leading", bidId: ownBid.id, amountUsd: ownBid.amountUsd, roundId: round.id });
    return;
  }

  if (!quote.shouldBid || targetUsd <= ownBid.amountUsd || targetUsd > config.maxBidUsd) {
    log("skip", { reason: quote.reason, bidId: ownBid.id, ownAmountUsd: ownBid.amountUsd, targetUsd, leader });
    return;
  }

  const deltaUsd = Number((targetUsd - ownBid.amountUsd).toFixed(6));
  const response = await paidJson("PATCH", `/bids/${ownBid.id}/increase`, {
    agentId: config.agentId,
    deltaUsd,
  });
  log("increase", { bidId: ownBid.id, deltaUsd, targetUsd, response });
}

function findOwnBid(bids: Bid[]) {
  return bids.find((bid) => bid.agentId === config.agentId || bid.company.toLowerCase() === config.company.toLowerCase());
}

function priceTarget(quote: Quote, leader?: Bid) {
  const leaderPlusStep = Number(((leader?.amountUsd ?? 0) + config.bidStepUsd).toFixed(6));
  return Number(Math.min(config.maxBidUsd, Math.max(quote.suggestedBidUsd, leaderPlusStep)).toFixed(6));
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${config.apiUrl}${path}`);
  return readJsonResponse<T>(response);
}

async function postFree<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${config.apiUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return readJsonResponse<T>(response);
}

async function paidJson(method: HttpMethod, path: string, body: unknown) {
  if (config.paymentMode !== "circle") {
    const response = await fetch(`${config.apiUrl}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        "x-arcade-payment-receipt": `docker-agent-${crypto.randomUUID()}`,
        "x-arcade-agent-wallet": config.agentId,
      },
      body: JSON.stringify(body),
    });
    return readJsonResponse(response);
  }

  const headers = { "content-type": "application/json" };
  const serializedBody = JSON.stringify(body);
  const initial = await fetch(`${config.apiUrl}${path}`, { method, headers, body: serializedBody });
  if (initial.status !== 402) {
    return readJsonResponse(initial);
  }

  const requiredHeader = initial.headers.get("payment-required");
  if (!requiredHeader) throw new Error("Missing payment-required header");
  const paymentRequired = JSON.parse(Buffer.from(requiredHeader, "base64").toString("utf8"));
  const option = paymentRequired.accepts.find((candidate: any) => candidate.network === "eip155:5042002");
  if (!option) throw new Error("Arc Testnet Gateway payment option not offered by server");

  const payload = await gateway!.createPaymentPayload(paymentRequired.x402Version ?? 2, option);
  const paymentHeader = Buffer.from(JSON.stringify({
    ...payload,
    resource: paymentRequired.resource,
    accepted: option,
  })).toString("base64");

  const paid = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: { ...headers, "Payment-Signature": paymentHeader },
    body: serializedBody,
  });
  return readJsonResponse(paid);
}

async function readJsonResponse<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(data)}`);
  }
  return data as T;
}

function defaultPrompt(company: string) {
  return [
    `Create a premium in-game roadside billboard for ${company}.`,
    "Use readable logo text, one product hero, strong contrast, and a sense of speed.",
    "Keep it native to an open-road driving game.",
  ].join(" ");
}

function log(event: string, data: unknown) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data as Record<string, unknown> }));
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}
