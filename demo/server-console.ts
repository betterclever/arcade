#!/usr/bin/env bun
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { EventEmitter } from "node:events";
import { BoxRenderable, createCliRenderer, TextRenderable } from "@opentui/core";

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

const palette = {
  bg: "#05070D",
  panel: "#0B1020",
  panelAlt: "#101827",
  cyan: "#22D3EE",
  cyanSoft: "#67E8F9",
  green: "#34D399",
  amber: "#FBBF24",
  pink: "#FB7185",
  violet: "#A78BFA",
  blue: "#60A5FA",
  text: "#E5E7EB",
  muted: "#94A3B8",
};

const apiUrl = process.env.ARCADE_API_URL ?? "http://localhost:8787/api";
const serverUrl = apiUrl.replace(/\/api\/?$/, "");
const surfaceId = process.env.ARCADE_SURFACE_ID ?? "raceway-billboard-main";
const logs: string[] = [];
const maxLogs = 14;

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
}) as ChildProcess;

server.stdout?.on("data", (chunk) => pushLog(chunk.toString()));
server.stderr?.on("data", (chunk) => pushLog(chunk.toString()));
(server as unknown as EventEmitter).on("exit", (code, signal) => {
  pushLog(`[server-console] server exited code=${code ?? "null"} signal=${signal ?? "null"}`);
});

const renderer = await createCliRenderer({
  backgroundColor: palette.bg,
  clearOnShutdown: true,
  consoleMode: "disabled",
  exitOnCtrlC: true,
  exitSignals: ["SIGINT", "SIGTERM", "SIGHUP"],
  screenMode: "alternate-screen",
  targetFps: 12,
  useMouse: false,
});

renderer.setTerminalTitle("Arcad Control Room");

function box(options: ConstructorParameters<typeof BoxRenderable>[1]) {
  return new BoxRenderable(renderer, {
    backgroundColor: palette.panel,
    border: true,
    borderColor: palette.cyan,
    borderStyle: "rounded",
    padding: 1,
    ...options,
  });
}

function text(options: ConstructorParameters<typeof TextRenderable>[1]) {
  return new TextRenderable(renderer, {
    fg: palette.text,
    wrapMode: "word",
    truncate: true,
    ...options,
  });
}

const rootBox = box({
  id: "root",
  backgroundColor: palette.bg,
  border: false,
  flexDirection: "column",
  gap: 1,
  height: "100%",
  padding: 1,
  width: "100%",
});

const headerBox = box({
  id: "header",
  height: 5,
  width: "100%",
  borderColor: palette.violet,
  borderStyle: "double",
  title: " ARCAD(E) ",
  titleAlignment: "center",
});
const headerText = text({ id: "header-text", content: "booting control room", fg: palette.cyanSoft, width: "100%", height: "100%" });
headerBox.add(headerText);

const topRow = box({
  id: "top-row",
  backgroundColor: palette.bg,
  border: false,
  flexDirection: "row",
  gap: 1,
  height: 10,
  padding: 0,
  width: "100%",
});

const processBox = box({
  id: "process",
  borderColor: palette.blue,
  flexGrow: 1,
  title: " PROCESS ",
});
const processText = text({ id: "process-text", content: "", fg: palette.text, height: "100%", width: "100%" });
processBox.add(processText);

const roundBox = box({
  id: "round",
  borderColor: palette.amber,
  flexGrow: 1,
  title: " ROUND CLOCK ",
});
const roundText = text({ id: "round-text", content: "", fg: palette.amber, height: "100%", width: "100%" });
roundBox.add(roundText);

const leaderBox = box({
  id: "leader",
  borderColor: palette.green,
  flexGrow: 1,
  title: " MARKET LEADER ",
});
const leaderText = text({ id: "leader-text", content: "", fg: palette.green, height: "100%", width: "100%" });
leaderBox.add(leaderText);

topRow.add(processBox);
topRow.add(roundBox);
topRow.add(leaderBox);

const middleRow = box({
  id: "middle-row",
  backgroundColor: palette.bg,
  border: false,
  flexDirection: "row",
  flexGrow: 1,
  gap: 1,
  minHeight: 12,
  padding: 0,
  width: "100%",
});

const bidsBox = box({
  id: "bids",
  borderColor: palette.cyan,
  flexGrow: 2,
  title: " LIVE BIDS ",
});
const bidsText = text({ id: "bids-text", content: "", fg: palette.cyanSoft, height: "100%", width: "100%" });
bidsBox.add(bidsText);

const paymentsBox = box({
  id: "payments",
  borderColor: palette.pink,
  flexGrow: 2,
  title: " X402 AUTHORIZATIONS ",
});
const paymentsText = text({ id: "payments-text", content: "", fg: palette.text, height: "100%", width: "100%" });
paymentsBox.add(paymentsText);

middleRow.add(bidsBox);
middleRow.add(paymentsBox);

const logsBox = box({
  id: "logs",
  backgroundColor: palette.panelAlt,
  borderColor: palette.violet,
  flexGrow: 1,
  minHeight: 10,
  title: " SERVER LOGS ",
  width: "100%",
});
const logsText = text({ id: "logs-text", content: "starting server...", fg: palette.muted, height: "100%", width: "100%" });
logsBox.add(logsText);

const footerBox = box({
  id: "footer",
  backgroundColor: palette.bg,
  border: false,
  height: 1,
  padding: 0,
  width: "100%",
});
const footerText = text({
  id: "footer-text",
  content: "ctrl-c stops dashboard + server",
  fg: palette.muted,
  height: 1,
  width: "100%",
});
footerBox.add(footerText);

rootBox.add(headerBox);
rootBox.add(topRow);
rootBox.add(middleRow);
rootBox.add(logsBox);
rootBox.add(footerBox);
renderer.root.add(rootBox);
renderer.start();

function money(value?: number) {
  return `$${Number(value ?? 0).toFixed(3)}`;
}

function duration(ms: number) {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

function shortId(value?: string) {
  if (!value) return "n/a";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function line(label: string, value: string) {
  return `${label.padEnd(13)} ${value}`;
}

function tableRow(status: string, amount: string, company: string, id: string) {
  return `${status.padEnd(10)} ${amount.padEnd(8)} ${company.slice(0, 20).padEnd(20)} ${shortId(id)}`;
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

async function getHealth(): Promise<{ databasePath?: string } | null> {
  try {
    const response = await fetch(`${serverUrl}/health`);
    if (!response.ok) return null;
    return await response.json() as { databasePath?: string };
  } catch {
    return null;
  }
}

function setBoxMood(leader: Bid | null, campaign?: Campaign) {
  const isLive = campaign?.round.status === "open";
  roundBox.borderColor = isLive ? palette.amber : palette.muted;
  leaderBox.borderColor = leader ? palette.green : palette.pink;
  leaderText.fg = leader ? palette.green : palette.pink;
  processBox.borderColor = server.exitCode === null ? palette.blue : palette.pink;
}

async function render() {
  const [campaigns, health, bids, payments] = await Promise.all([
    getJson<{ campaigns: Campaign[] }>("/campaigns"),
    getHealth(),
    getJson<{ bids: Bid[] }>(`/surfaces/${surfaceId}/bids`),
    getJson<{ payments: Payment[] }>(`/surfaces/${surfaceId}/payments`),
  ]);

  const campaign = campaigns?.campaigns?.[0];
  const leader = campaign?.leadingBid ?? bids?.bids?.find((bid) => bid.status === "leading") ?? null;
  const recentPayments = [...(payments?.payments ?? [])].sort((a, b) => b.createdAt - a.createdAt).slice(0, 9);
  const recentBids = [...(bids?.bids ?? [])]
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0))
    .slice(0, 9);

  setBoxMood(leader, campaign);

  headerText.content = [
    "DYNAMIC AGENT ADS / CIRCLE X402 / LIVE AUCTION SETTLEMENT",
    `${campaign?.surface.game ?? "waiting for game"} :: ${campaign?.surface.title ?? surfaceId}`,
  ].join("\n");

  processText.content = [
    line("server", server.exitCode === null ? `running pid=${server.pid}` : `stopped code=${server.exitCode}`),
    line("api", apiUrl),
    line("sqlite", health?.databasePath ? shortId(health.databasePath) : "connecting"),
    line("surface", campaign?.surface.id ?? surfaceId),
  ].join("\n");

  roundText.content = campaign
    ? [
        line("round", shortId(campaign.round.id)),
        line("status", campaign.round.status.toUpperCase()),
        line("time left", duration(campaign.round.endsAt - Date.now())),
        line("range", `${money(campaign.minBidUsd)} - ${money(campaign.maxBidUsd)}`),
      ].join("\n")
    : ["round         waiting", "status        connecting", "time left     n/a", "range         n/a"].join("\n");

  leaderText.content = leader
    ? [
        leader.company.toUpperCase(),
        `${money(leader.amountUsd)}  ${leader.status}`,
        `agent ${shortId(leader.agentId)}`,
        `bid   ${shortId(leader.id)}`,
      ].join("\n")
    : ["NO LEADER", "agents are still scouting", "", "watcher will wake sessions"].join("\n");

  bidsText.content = recentBids.length
    ? [
        tableRow("STATUS", "AMOUNT", "COMPANY", "BID"),
        "".padEnd(56, "-"),
        ...recentBids.map((bid) => tableRow(bid.status.toUpperCase(), money(bid.amountUsd), bid.company, bid.id)),
      ].join("\n")
    : "no bids in current round";

  paymentsText.content = recentPayments.length
    ? [
        `${"AMOUNT".padEnd(8)} ${"SETTLEMENT".padEnd(18)} ${"REFUND".padEnd(14)} BID`,
        "".padEnd(62, "-"),
        ...recentPayments.map((payment) => {
          return `${money(payment.amountUsd).padEnd(8)} ${payment.settlementStatus.slice(0, 18).padEnd(18)} ${payment.refundStatus.slice(0, 14).padEnd(14)} ${shortId(payment.bidId)}`;
        }),
      ].join("\n")
    : "no payment ledger entries yet";

  logsText.content = logs.length ? logs.map((entry) => `> ${entry}`).join("\n") : "> starting server...";

  footerText.content = `last refresh ${new Date().toLocaleTimeString()}  |  ctrl-c stops dashboard + server`;
  renderer.requestRender();
}

const interval = setInterval(() => {
  render().catch((error) => pushLog(`[server-console] ${error instanceof Error ? error.message : String(error)}`));
}, 1_000);

let shuttingDown = false;
async function shutdown(signal?: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  clearInterval(interval);
  if (server.exitCode === null) server.kill(signal ?? "SIGTERM");
  renderer.destroy();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

await render();
