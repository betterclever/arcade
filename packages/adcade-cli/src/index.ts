#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import { privateKeyToAccount } from "viem/accounts";
import { GatewayClient, type SupportedChainName } from "@circle-fin/x402-batching/client";

type PaymentMode = "mock" | "circle";
type HttpMethod = "GET" | "POST" | "PATCH";

interface AgentConfig {
  apiUrl: string;
  surfaceId: string;
  agentId: string;
  company: string;
  maxBidUsd: number;
  valuePerImpressionUsd: number;
  expectedImpressions: number;
  intervalMs: number;
  paymentMode: PaymentMode;
}

interface Quote {
  shouldBid: boolean;
  suggestedBidUsd: number;
  reason: string;
}

interface BidResponse {
  bid?: {
    id?: string;
  };
  [key: string]: unknown;
}

const DEFAULT_API_URL = "http://localhost:8787/api";
const DEFAULT_SURFACE_ID = "raceway-billboard-main";

export async function main(argv = process.argv.slice(2)) {
  const [command, subcommand, ...rest] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "wallet") {
    await walletCommand(subcommand ?? "help", rest);
    return;
  }

  if (command === "status" || command === "surface") {
    await printSurface(parseConfig(rest), rest);
    return;
  }

  if (command === "quote") {
    const quote = await getQuote(parseConfig(rest));
    printJson(quote);
    return;
  }

  if (command === "bid") {
    const response = await bidOnce(parseConfig(rest), rest);
    printJson(response);
    return;
  }

  if (command === "increase") {
    const response = await increaseBid(parseConfig(rest), rest);
    printJson(response);
    return;
  }

  if (command === "loop") {
    await runLoop(parseConfig(rest), rest);
    return;
  }

  if (command === "operator" && subcommand === "close-round") {
    const response = await closeRound(parseConfig(rest), rest);
    printJson(response);
    return;
  }

  throw new Error(`Unknown command: ${argv.join(" ")}`);
}

function printHelp() {
  console.log(`Adcade CLI

Usage:
  adcade wallet create
  adcade wallet address
  adcade wallet balances
  adcade wallet deposit <amount>
  adcade status
  adcade quote
  adcade bid [--amount 0.005] [--prompt "..."]
  adcade increase --bid <bidId> --delta 0.001
  adcade loop [--interval-ms 300000]
  adcade operator close-round

Install from git:
  bunx <git_path> wallet create
  bunx <git_path> loop

Core env:
  ARCADE_API_URL=${DEFAULT_API_URL}
  ARCADE_SURFACE_ID=${DEFAULT_SURFACE_ID}
  AGENT_ID=volt-rush-agent
  COMPANY_NAME=VoltRush
  ARCADE_PAYMENT_MODE=mock | circle

Circle mode:
  ARCADE_BUYER_PRIVATE_KEY=0x...
  ARCADE_CHAIN=arcTestnet
  ARCADE_RPC_URL=https://...

Funding:
  1. adcade wallet create
  2. Fund the printed address with Arc Testnet USDC at https://faucet.circle.com/
  3. export ARCADE_BUYER_PRIVATE_KEY=0x...
  4. adcade wallet deposit 1.00
  5. adcade loop
`);
}

async function walletCommand(command: string, argv: string[]) {
  if (command === "create") {
    const privateKey = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    printJson({ privateKey, address: account.address });
    return;
  }

  if (command === "help" || !["address", "balances", "deposit"].includes(command)) {
    console.log(`Adcade wallet commands

  wallet create              Generate a fresh EVM private key and address
  wallet address             Print address for ARCADE_BUYER_PRIVATE_KEY
  wallet balances            Show wallet and Circle Gateway balances
  wallet deposit <amount>    Deposit USDC into Circle Gateway, e.g. 1.00

Circle Faucet:
  https://faucet.circle.com/
`);
    if (command !== "help") process.exitCode = 1;
    return;
  }

  const client = createGatewayClient();

  if (command === "address") {
    console.log(client.address);
    return;
  }

  if (command === "balances") {
    printJson(await client.getBalances());
    return;
  }

  const amount = argv[0];
  if (!amount) throw new Error("Usage: adcade wallet deposit <amount>");
  printJson(await client.deposit(amount));
}

async function printSurface(config: AgentConfig, argv: string[]) {
  const surfaceId = readFlag(argv, "surface", config.surfaceId);
  const response = await fetch(`${config.apiUrl}/surfaces/${surfaceId}`);
  await printResponse(response);
}

async function getQuote(config: AgentConfig): Promise<Quote> {
  return postJson(config, "/agents/quote", {
    surfaceId: config.surfaceId,
    agentId: config.agentId,
    company: config.company,
    maxBidUsd: config.maxBidUsd,
    valuePerImpressionUsd: config.valuePerImpressionUsd,
    expectedImpressions: config.expectedImpressions,
  }) as Promise<Quote>;
}

async function bidOnce(config: AgentConfig, argv: string[]) {
  const quote = await getQuote(config);
  const amountFromFlag = readFlag(argv, "amount");
  const amountUsd = amountFromFlag ? Number(amountFromFlag) : quote.suggestedBidUsd;

  if (!amountFromFlag && !quote.shouldBid) {
    return { skipped: true, reason: quote.reason, quote };
  }

  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error(`Invalid bid amount: ${amountFromFlag ?? quote.suggestedBidUsd}`);
  }

  const prompt = readFlag(argv, "prompt") ?? defaultPrompt(config.company);
  return postJson(config, `/surfaces/${config.surfaceId}/bids`, {
    agentId: config.agentId,
    company: config.company,
    amountUsd,
    prompt,
    rationale: quote.reason,
  });
}

async function increaseBid(config: AgentConfig, argv: string[]) {
  const bidId = requiredFlag(argv, "bid");
  const deltaUsd = Number(requiredFlag(argv, "delta"));
  if (!Number.isFinite(deltaUsd) || deltaUsd <= 0) {
    throw new Error("--delta must be a positive number");
  }

  return patchJson(config, `/bids/${bidId}/increase`, {
    agentId: config.agentId,
    deltaUsd,
  });
}

async function runLoop(config: AgentConfig, argv: string[]) {
  const intervalMs = Number(readFlag(argv, "interval-ms", String(config.intervalMs)));
  const once = async () => {
    const startedAt = new Date().toISOString();
    const response = await bidOnce(config, argv);
    console.log(`[${startedAt}] ${JSON.stringify(response, bigintReplacer)}`);
  };

  await once();
  setInterval(() => {
    once().catch((error) => {
      console.error(`[${new Date().toISOString()}] bid loop failed: ${messageFromError(error)}`);
    });
  }, intervalMs);
}

async function closeRound(config: AgentConfig, argv: string[]) {
  const surfaceId = readFlag(argv, "surface", config.surfaceId);
  return postJson(config, `/surfaces/${surfaceId}/close-round`, {});
}

async function postJson(config: AgentConfig, path: string, body: unknown) {
  return paidJson(config, "POST", path, body);
}

async function patchJson(config: AgentConfig, path: string, body: unknown) {
  return paidJson(config, "PATCH", path, body);
}

async function paidJson(config: AgentConfig, method: HttpMethod, path: string, body: unknown) {
  if (config.paymentMode === "circle" && isPaidPath(path)) {
    const client = createGatewayClient();
    const result = await client.pay(`${config.apiUrl}${path}`, {
      method: method as "GET" | "POST" | "PUT" | "DELETE",
      headers: { "content-type": "application/json" },
      body,
    });
    return result.data;
  }

  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-arcade-payment-receipt": `mock-cli-${crypto.randomUUID()}`,
      "x-arcade-agent-wallet": process.env.AGENT_WALLET ?? config.agentId,
    },
    body: JSON.stringify(body),
  });
  return readJsonResponse(response);
}

function createGatewayClient() {
  const privateKey = process.env.ARCADE_BUYER_PRIVATE_KEY as `0x${string}` | undefined;
  if (!privateKey) {
    throw new Error("ARCADE_BUYER_PRIVATE_KEY is required. Run `adcade wallet create` or export an existing key.");
  }

  return new GatewayClient({
    chain: (process.env.ARCADE_CHAIN ?? "arcTestnet") as SupportedChainName,
    privateKey,
    rpcUrl: process.env.ARCADE_RPC_URL,
  });
}

function parseConfig(argv: string[]): AgentConfig {
  return {
    apiUrl: stripTrailingSlash(readFlag(argv, "api-url", process.env.ARCADE_API_URL ?? DEFAULT_API_URL)),
    surfaceId: readFlag(argv, "surface", process.env.ARCADE_SURFACE_ID ?? DEFAULT_SURFACE_ID),
    agentId: readFlag(argv, "agent", process.env.AGENT_ID ?? "volt-rush-agent"),
    company: readFlag(argv, "company", process.env.COMPANY_NAME ?? "VoltRush"),
    maxBidUsd: Number(readFlag(argv, "max-bid", process.env.MAX_BID_USD ?? "0.01")),
    valuePerImpressionUsd: Number(readFlag(argv, "value-per-impression", process.env.VALUE_PER_IMPRESSION_USD ?? "0.00002")),
    expectedImpressions: Number(readFlag(argv, "expected-impressions", process.env.EXPECTED_IMPRESSIONS ?? "350")),
    intervalMs: Number(readFlag(argv, "interval-ms", process.env.BID_LOOP_MS ?? String(5 * 60 * 1000))),
    paymentMode: (readFlag(argv, "payment-mode", process.env.ARCADE_PAYMENT_MODE ?? "mock") as PaymentMode),
  };
}

function readFlag(argv: string[], name: string, fallback?: string): string {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return fallback ?? "";
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`--${name} requires a value`);
  }
  return value;
}

function requiredFlag(argv: string[], name: string) {
  const value = readFlag(argv, name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
}

function defaultPrompt(company: string) {
  return [
    `Create a premium in-game racing billboard for ${company}.`,
    "Use bold readable logo text, fast motion, and one memorable product hero.",
    "The ad should feel native to a racing game and stay legible from a moving car.",
  ].join(" ");
}

function isPaidPath(path: string) {
  return path.includes("/bids");
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

async function printResponse(response: Response) {
  printJson(await readJsonResponse(response));
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

function printJson(value: unknown) {
  console.log(JSON.stringify(value, bigintReplacer, 2));
}

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === "bigint" ? value.toString() : value;
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(messageFromError(error));
    process.exit(1);
  });
}
