#!/usr/bin/env bun
import { spawn } from "node:child_process";

type Campaign = {
  round: { id: string; status: string; startsAt: number; endsAt: number };
  surface: { id: string; title: string; game: string };
  bidCount: number;
  minBidUsd: number;
  maxBidUsd: number;
  leadingBid?: Bid | null;
  lastWinner?: Bid | null;
};

type Bid = {
  id: string;
  agentId: string;
  company: string;
  amountUsd: number;
  status: string;
  roundId: string;
  updatedAt?: number;
  createdAt?: number;
};

type Payment = {
  id: string;
  bidId: string;
  payer?: string;
  amountUsd: number;
  settlementStatus: string;
  refundStatus: string;
  refundReason?: string;
  createdAt: number;
};

const apiUrl = process.env.ARCADE_API_URL ?? "http://localhost:8787/api";
const surfaceId = process.env.ARCADE_SURFACE_ID ?? "raceway-billboard-main";
const logs: string[] = [];
const maxLogs = 12;

function pushLog(line: string) {
  const clean = line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
  if (!clean) return;
  for (const item of clean.split(/\r?\n/)) {
    logs.push(item);
    while (logs.length > maxLogs) logs.shift();
  }
}

const server = spawn("bun", ["src/index.ts"], {
  cwd: `${process.cwd()}/apps/server`,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.on("data", (chunk) => pushLog(chunk.toString()));
server.stderr.on("data", (chunk) => pushLog(chunk.toString()));
server.on("exit", (code, signal) => {
  pushLog(`[server-console] server exited code=${code ?? "null"} signal=${signal ?? "null"}`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    server.kill(signal);
    process.exit(0);
  });
}

function money(value?: number) {
  return `$${Number(value ?? 0).toFixed(3)}`;
}

function duration(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function line(label: string, value: string) {
  return `${label.padEnd(18)} ${value}`;
}

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${apiUrl}${path}`);
    if (!response.ok) return null;
    return await response.json() as T;
  } catch {
    return null;
  }
}

async function render() {
  const campaigns = await getJson<{ campaigns: Campaign[] }>("/campaigns");
  const bids = await getJson<{ bids: Bid[] }>(`/surfaces/${surfaceId}/bids`);
  const payments = await getJson<{ payments: Payment[] }>(`/surfaces/${surfaceId}/payments`);
  const campaign = campaigns?.campaigns?.[0];
  const leader = campaign?.leadingBid ?? bids?.bids?.find((bid) => bid.status === "leading") ?? null;
  const recentPayments = [...(payments?.payments ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);
  const recentBids = [...(bids?.bids ?? [])].sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0)).slice(0, 6);

  const rows = [
    "ARCAD SERVER CONTROL ROOM",
    "==========================",
    line("process", server.exitCode === null ? `running pid=${server.pid}` : `stopped code=${server.exitCode}`),
    line("api", apiUrl),
    line("surface", campaign ? `${campaign.surface.game} / ${campaign.surface.title}` : "waiting for server"),
    line("round", campaign ? `${campaign.round.id} (${campaign.round.status})` : "n/a"),
    line("time left", campaign ? duration(campaign.round.endsAt - Date.now()) : "n/a"),
    line("bid range", campaign ? `${money(campaign.minBidUsd)} - ${money(campaign.maxBidUsd)}` : "n/a"),
    line("leader", leader ? `${leader.company} ${money(leader.amountUsd)} [${leader.status}]` : "no leader"),
    line("last winner", campaign?.lastWinner ? `${campaign.lastWinner.company} ${money(campaign.lastWinner.amountUsd)}` : "none yet"),
    "",
    "BIDS",
    ...(
      recentBids.length
        ? recentBids.map((bid) => `  ${bid.status.padEnd(8)} ${money(bid.amountUsd).padEnd(8)} ${bid.company.padEnd(14)} ${bid.id}`)
        : ["  no bids in current round"]
    ),
    "",
    "PAYMENTS / AUTHORIZATIONS",
    ...(
      recentPayments.length
        ? recentPayments.map((payment) => `  ${money(payment.amountUsd).padEnd(8)} ${payment.settlementStatus.padEnd(18)} ${payment.refundStatus.padEnd(14)} ${payment.bidId}`)
        : ["  no payment ledger entries yet"]
    ),
    "",
    "SERVER LOGS",
    ...(logs.length ? logs.map((entry) => `  ${entry}`) : ["  starting server..."]),
    "",
    "ctrl-c stops server and dashboard",
  ];

  process.stdout.write("\x1b[2J\x1b[H");
  process.stdout.write(`${rows.join("\n")}\n`);
}

setInterval(() => {
  render().catch((error) => pushLog(`[server-console] ${error instanceof Error ? error.message : String(error)}`));
}, 1_000);
await render();
