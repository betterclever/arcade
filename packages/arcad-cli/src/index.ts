#!/usr/bin/env bun
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
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
const CIRCLE_FAUCET_URL = "https://faucet.circle.com/";
const ARCAD_HOME = process.env.ARCAD_HOME ?? join(homedir(), ".arcad");
const ACTIVE_WALLET_FILE = join(ARCAD_HOME, "active-wallet");
const KEYSTORE_DIR = process.env.ARCAD_KEYSTORE_DIR ?? join(ARCAD_HOME, "keystores");

export async function main(argv = process.argv.slice(2)) {
  const [command] = argv;
  const args = argv.slice(1);

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "wallet") {
    const [subcommand = "help", ...rest] = args;
    await walletCommand(subcommand, rest);
    return;
  }

  if (command === "faucet") {
    await openFaucet(args);
    return;
  }

  if (command === "status" || command === "surface") {
    await printSurface(parseConfig(args), args);
    return;
  }

  if (command === "bids") {
    await printBids(parseConfig(args), args);
    return;
  }

  if (command === "rounds") {
    await printRounds(parseConfig(args), args);
    return;
  }

  if (command === "winner" || command === "winners") {
    await printWinner(parseConfig(args), args);
    return;
  }

  if (command === "payments" || command === "txns" || command === "transactions") {
    await printPayments(parseConfig(args), args);
    return;
  }

  if (command === "payment" || command === "txn" || command === "transaction") {
    const [paymentId, ...rest] = args;
    await printPayment(parseConfig(rest), paymentId);
    return;
  }

  if (command === "bid-detail") {
    const [bidId, ...rest] = args;
    await printBidDetail(parseConfig(rest), bidId);
    return;
  }

  if (command === "refund") {
    const [bidId, ...rest] = args;
    await printRefundStatus(parseConfig(rest), bidId);
    return;
  }

  if (command === "supports") {
    await printPaymentSupport(parseConfig(args), args);
    return;
  }

  if (command === "quote") {
    const quote = await getQuote(parseConfig(args));
    printJson(quote);
    return;
  }

  if (command === "bid") {
    const response = await bidOnce(parseConfig(args), args);
    printJson(response);
    return;
  }

  if (command === "increase") {
    const response = await increaseBid(parseConfig(args), args);
    printJson(response);
    return;
  }

  if (command === "loop") {
    await runLoop(parseConfig(args), args);
    return;
  }

  if (command === "operator" && args[0] === "close-round") {
    const rest = args.slice(1);
    const response = await closeRound(parseConfig(rest), rest);
    printJson(response);
    return;
  }

  throw new Error(`Unknown command: ${argv.join(" ")}`);
}

function printHelp() {
  console.log(`Arcad CLI

Usage:
  arcad wallet new [name]
  arcad wallet import <name> --private-key 0x...
  arcad wallet list
  arcad wallet use <name>
  arcad wallet whoami
  arcad wallet address
  arcad wallet balances
  arcad wallet deposit <amount>
  arcad faucet [--address 0x...] [--no-open]
  arcad status
  arcad bids
  arcad rounds
  arcad winner
  arcad payments
  arcad payment <paymentId>
  arcad bid-detail <bidId>
  arcad refund <bidId>
  arcad supports [--path /surfaces/raceway-billboard-main/bids]
  arcad quote
  arcad bid [--amount 0.005] [--prompt "..."]
  arcad increase --bid <bidId> --delta 0.001
  arcad loop [--interval-ms 300000]
  arcad operator close-round

Install from git:
  bunx <git_path> wallet new bidder
  bunx <git_path> loop

Core env:
  ARCADE_API_URL=${DEFAULT_API_URL}
  ARCADE_SURFACE_ID=${DEFAULT_SURFACE_ID}
  AGENT_ID=volt-rush-agent
  COMPANY_NAME=VoltRush
  ARCADE_PAYMENT_MODE=mock | circle

Circle mode:
  ARCAD_WALLET_PASSWORD=...
  ARCADE_CHAIN=arcTestnet
  ARCADE_RPC_URL=https://...

Funding:
  1. arcad wallet new bidder
  2. arcad faucet
  3. arcad wallet deposit 1.00
  4. arcad loop
`);
}

async function openFaucet(argv: string[]) {
  const explicitAddress = readFlag(argv, "address");
  const noOpen = hasFlag(argv, "no-open");
  const noCopy = hasFlag(argv, "no-copy");
  const wallet = resolveFaucetWallet(explicitAddress);
  const copiedToClipboard = noCopy ? false : await copyToClipboard(wallet.address);
  const opened = noOpen ? false : await openUrl(CIRCLE_FAUCET_URL);

  printJson({
    faucetUrl: CIRCLE_FAUCET_URL,
    network: "Arc Testnet",
    token: "USDC",
    address: wallet.address,
    generatedPrivateKey: wallet.generatedPrivateKey,
    copiedToClipboard,
    opened,
    nextSteps: [
      "In Circle Faucet, choose Arc Testnet and USDC.",
      "Paste the address above.",
      "After funds arrive, run: arcad wallet balances",
      "Then run: arcad wallet deposit 1.00",
    ],
    note: wallet.generatedPrivateKey
      ? "A fresh wallet was generated because no active Arcad wallet or --address was provided. Store the private key securely or run `arcad wallet new <name>` to create a managed keystore."
      : "Use the same address/private key for faucet funding and Gateway deposit.",
  });
}

function resolveFaucetWallet(explicitAddress: string) {
  if (explicitAddress) {
    return { address: explicitAddress, generatedPrivateKey: undefined };
  }

  const activeWallet = getActiveWalletName();
  if (activeWallet) {
    return { address: addressForAccount(activeWallet), generatedPrivateKey: undefined };
  }

  const generatedPrivateKey = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
  return {
    address: privateKeyToAccount(generatedPrivateKey).address,
    generatedPrivateKey,
  };
}

async function walletCommand(command: string, argv: string[]) {
  if (command === "create" || command === "new") {
    const name = argv[0] && !argv[0].startsWith("--") ? argv[0] : `agent-${Date.now()}`;
    const privateKey = `0x${randomBytes(32).toString("hex")}` as `0x${string}`;
    const account = privateKeyToAccount(privateKey);
    await importKeystore(name, privateKey);
    setActiveWallet(name);
    printJson({ name, address: account.address, active: true, keystoreDir: KEYSTORE_DIR });
    return;
  }

  if (command === "import") {
    const name = argv[0];
    if (!name || name.startsWith("--")) throw new Error("Usage: arcad wallet import <name> --private-key 0x...");
    const privateKey = requiredFlag(argv, "private-key") as `0x${string}`;
    await importKeystore(name, privateKey);
    setActiveWallet(name);
    printJson({ name, address: privateKeyToAccount(privateKey).address, active: true, keystoreDir: KEYSTORE_DIR });
    return;
  }

  if (command === "list" || command === "ls") {
    printJson({ active: getActiveWalletName(), wallets: listWallets(), keystoreDir: KEYSTORE_DIR });
    return;
  }

  if (command === "use") {
    const name = argv[0];
    if (!name) throw new Error("Usage: arcad wallet use <name>");
    if (!walletExists(name)) throw new Error(`Wallet not found: ${name}`);
    setActiveWallet(name);
    printJson({ active: name, address: addressForAccount(name) });
    return;
  }

  if (command === "whoami" || command === "active") {
    const name = requireActiveWalletName();
    printJson({ active: name, address: addressForAccount(name), keystoreDir: KEYSTORE_DIR });
    return;
  }

  if (command === "help" || !["address", "balances", "deposit"].includes(command)) {
    console.log(`Arcad wallet commands

  wallet new [name]                       Create an encrypted Foundry keystore
  wallet import <name> --private-key 0x   Import a key into the keystore
  wallet list                             List local Arcad wallets
  wallet use <name>                       Select the active wallet
  wallet whoami                           Show active wallet and address
  wallet address                          Print active wallet address
  wallet balances            Show wallet and Circle Gateway balances
  wallet deposit <amount>    Deposit USDC into Circle Gateway, e.g. 1.00

Env:
  ARCAD_WALLET_PASSWORD=...               Non-interactive keystore password

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
  if (!amount) throw new Error("Usage: arcad wallet deposit <amount>");
  printJson(await client.deposit(amount));
}

async function printSurface(config: AgentConfig, argv: string[]) {
  const surfaceId = readFlag(argv, "surface", config.surfaceId);
  printJson(await getJson(config, `/surfaces/${surfaceId}`));
}

async function printBids(config: AgentConfig, argv: string[]) {
  const surfaceId = readFlag(argv, "surface", config.surfaceId);
  printJson(await getJson(config, `/surfaces/${surfaceId}/bids`));
}

async function printRounds(config: AgentConfig, argv: string[]) {
  const surfaceId = readFlag(argv, "surface", config.surfaceId);
  printJson(await getJson(config, `/surfaces/${surfaceId}/rounds`));
}

async function printWinner(config: AgentConfig, argv: string[]) {
  const surfaceId = readFlag(argv, "surface", config.surfaceId);
  const snapshot = await getJson(config, `/surfaces/${surfaceId}`) as {
    lastClosedRound?: unknown;
    lastWinner?: unknown;
    lastRoundPayments?: unknown;
  };
  printJson({
    lastClosedRound: snapshot.lastClosedRound ?? null,
    lastWinner: snapshot.lastWinner ?? null,
    payments: snapshot.lastRoundPayments ?? [],
  });
}

async function printPayments(config: AgentConfig, argv: string[]) {
  const surfaceId = readFlag(argv, "surface", config.surfaceId);
  printJson(await getJson(config, `/surfaces/${surfaceId}/payments`));
}

async function printPayment(config: AgentConfig, paymentId = "") {
  if (!paymentId) throw new Error("Usage: arcad payment <paymentId>");
  printJson(await getJson(config, `/payments/${paymentId}`));
}

async function printBidDetail(config: AgentConfig, bidId = "") {
  if (!bidId) throw new Error("Usage: arcad bid-detail <bidId>");
  printJson(await getJson(config, `/bids/${bidId}`));
}

async function printRefundStatus(config: AgentConfig, bidId = "") {
  if (!bidId) throw new Error("Usage: arcad refund <bidId>");
  printJson(await getJson(config, `/bids/${bidId}/refund`));
}

async function printPaymentSupport(config: AgentConfig, argv: string[]) {
  const path = readFlag(argv, "path", `/surfaces/${config.surfaceId}/bids`);
  const method = readFlag(argv, "method", "POST").toUpperCase();
  const response = await fetch(`${config.apiUrl}${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify({}),
  });
  const challenge = response.headers.get("payment-required");
  printJson({
    supported: response.status === 402 && Boolean(challenge),
    status: response.status,
    challenge: challenge ? decodePaymentRequired(challenge) : null,
  });
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

  const prompt = readFlag(argv, "prompt") || defaultPrompt(config.company);
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

async function getJson(config: AgentConfig, path: string) {
  const response = await fetch(`${config.apiUrl}${path}`);
  return readJsonResponse(response);
}

function createGatewayClient() {
  const privateKey = loadActivePrivateKey();

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

function hasFlag(argv: string[], name: string) {
  return argv.includes(`--${name}`);
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

async function importKeystore(name: string, privateKey: `0x${string}`) {
  ensureArcadHome();
  if (!process.env.ARCAD_WALLET_PASSWORD) {
    throw new Error("ARCAD_WALLET_PASSWORD is required for demo keystore import/new. Set it before running wallet new/import.");
  }
  await runCommand("cast", [
    "wallet",
    "import",
    "--keystore-dir",
    KEYSTORE_DIR,
    "--unsafe-password",
    process.env.ARCAD_WALLET_PASSWORD,
    "--private-key",
    privateKey,
    name,
  ]);
}

function loadActivePrivateKey() {
  const name = requireActiveWalletName();
  return loadPrivateKeyForAccount(name);
}

function loadPrivateKeyForAccount(name: string) {
  if (!process.env.ARCAD_WALLET_PASSWORD) {
    throw new Error("ARCAD_WALLET_PASSWORD is required to decrypt the active wallet.");
  }
  const output = runCommandSync("cast", [
    "wallet",
    "decrypt-keystore",
    "--keystore-dir",
    KEYSTORE_DIR,
    "--unsafe-password",
    process.env.ARCAD_WALLET_PASSWORD,
    name,
  ]);
  const match = output.match(/0x[0-9a-fA-F]{64}/);
  if (!match) throw new Error(`Could not decrypt wallet ${name}`);
  return match[0] as `0x${string}`;
}

function addressForAccount(name: string) {
  return privateKeyToAccount(loadPrivateKeyForAccount(name)).address;
}

function listWallets() {
  ensureArcadHome();
  const output = runCommandSync("cast", ["wallet", "list", "--dir", KEYSTORE_DIR], { allowFailure: true });
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function walletExists(name: string) {
  return listWallets().some((line) => line === name || line.startsWith(`${name} `));
}

function getActiveWalletName() {
  try {
    return readFileSync(ACTIVE_WALLET_FILE, "utf8").trim() || undefined;
  } catch {
    return undefined;
  }
}

function requireActiveWalletName() {
  const name = getActiveWalletName();
  if (!name) {
    throw new Error("No active Arcad wallet. Run `arcad wallet new bidder` or `arcad wallet use <name>`.");
  }
  return name;
}

function setActiveWallet(name: string) {
  ensureArcadHome();
  writeFileSync(ACTIVE_WALLET_FILE, `${name}\n`, { mode: 0o600 });
}

function ensureArcadHome() {
  mkdirSync(dirname(ACTIVE_WALLET_FILE), { recursive: true, mode: 0o700 });
  mkdirSync(KEYSTORE_DIR, { recursive: true, mode: 0o700 });
}

async function openUrl(url: string) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "cmd"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  return runQuiet(command, args);
}

async function copyToClipboard(value: string) {
  const command =
    process.platform === "darwin"
      ? "pbcopy"
      : process.platform === "win32"
        ? "clip"
        : "wl-copy";
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, [], { stdio: ["pipe", "ignore", "ignore"] }) as any;
    child.on("error", () => resolve(false));
    child.on("close", (code: number) => resolve(code === 0));
    child.stdin.end(value);
  });
}

async function runQuiet(command: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { stdio: "ignore", detached: true }) as any;
    child.on("error", () => resolve(false));
    child.on("spawn", () => {
      child.unref();
      resolve(true);
    });
  });
}

async function runCommand(command: string, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] }) as any;
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    child.on("error", reject);
    child.on("close", (code: number) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr.trim() || `${command} exited with ${code}`));
    });
  });
}

function runCommandSync(command: string, args: string[], options: { allowFailure?: boolean } = {}) {
  const proc = Bun.spawnSync([command, ...args], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(proc.stdout);
  const stderr = new TextDecoder().decode(proc.stderr);
  if (proc.exitCode !== 0 && !options.allowFailure) {
    throw new Error(stderr.trim() || `${command} exited with ${proc.exitCode}`);
  }
  return stdout;
}

function decodePaymentRequired(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    try {
      return JSON.parse(Buffer.from(value, "base64").toString("utf8"));
    } catch {
      return value;
    }
  }
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
