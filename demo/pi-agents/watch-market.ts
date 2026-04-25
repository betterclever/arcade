#!/usr/bin/env bun
import { spawnSync } from "node:child_process";

type Bid = {
	id: string;
	roundId: string;
	agentId: string;
	company: string;
	amountUsd: number;
	status: string;
	prompt?: string;
};

type Market = {
	surfaceId: string;
	roundId: string;
	endsAt: number;
	bids: Bid[];
};

const root = "/Users/betterclever/newprojects/experiments/circlehack";
const apiUrl = process.env.ARCADE_API_URL ?? "http://localhost:8787/api";
const intervalMs = Math.max(2_000, Number(process.env.ARCAD_MARKET_WATCH_MS ?? 5_000));
const controlExtension =
	process.env.PI_CONTROL_EXTENSION ??
	`${process.env.HOME}/.local/share/nvm/v25.9.0/lib/node_modules/mitsupi/extensions/control.ts`;

const agents = (process.env.ARCAD_WATCH_AGENTS ?? "volt-rush:arcad-volt-rush,northline:arcad-northline")
	.split(",")
	.map((entry) => {
		const [agentId, sessionName] = entry.split(":");
		return { agentId, sessionName: sessionName ?? `arcad-${agentId}` };
	})
	.filter((agent) => agent.agentId && agent.sessionName);

const lastSignal = new Map<string, string>();
let lastEmptyRoundSignal = "";

function compactBid(bid?: Bid) {
	if (!bid) return null;
	return {
		id: bid.id,
		roundId: bid.roundId,
		agentId: bid.agentId,
		company: bid.company,
		amountUsd: bid.amountUsd,
		status: bid.status,
	};
}

async function fetchMarket(): Promise<Market | null> {
	const campaignsResponse = await fetch(`${apiUrl}/campaigns`);
	if (!campaignsResponse.ok) {
		throw new Error(`GET /campaigns failed: ${campaignsResponse.status} ${await campaignsResponse.text()}`);
	}
	const campaignsJson = await campaignsResponse.json();
	const campaign = campaignsJson.campaigns?.[0];
	const surfaceId = campaign?.surface?.id;
	const roundId = campaign?.round?.id;
	if (!surfaceId || !roundId) return null;

	const response = await fetch(`${apiUrl}/surfaces/${surfaceId}/bids`);
	if (!response.ok) {
		throw new Error(`GET /surfaces/${surfaceId}/bids failed: ${response.status} ${await response.text()}`);
	}
	const json = await response.json();
	return {
		surfaceId,
		roundId,
		endsAt: campaign.endsAt,
		bids: json.bids ?? [],
	};
}

function sendToSession(sessionName: string, message: string): boolean {
	const result = spawnSync(
		"pi",
		[
			"-p",
			"--no-extensions",
			"--no-context-files",
			"--no-skills",
			"--extension",
			controlExtension,
			"--session-control",
			"--control-session",
			sessionName,
			"--send-session-message",
			message,
			"--send-session-mode",
			"follow_up",
			"--send-session-wait",
			"message_processed",
			"--model",
			process.env.PI_MODEL ?? "openai-codex/gpt-5.4-mini",
		],
		{
			cwd: root,
			env: process.env,
			encoding: "utf8",
			timeout: 30_000,
		},
	);

	if (result.status !== 0) {
		console.error(`[watcher] failed to signal ${sessionName}:`, result.stderr || result.stdout);
		return false;
	}
	return true;
}

function buildMessage(agentId: string, leader: Bid, mine?: Bid): string {
	return [
		`[ARCAD MARKET SIGNAL] competitor bid observed for ${agentId}.`,
		`Leader: ${JSON.stringify(compactBid(leader))}`,
		`Your bid: ${JSON.stringify(compactBid(mine))}`,
		"",
		"React now with one cycle:",
		"1. Run campaigns, bids, and status.",
		"2. If your bid is outbid and the price is still worth it under MAX_BID_USD, increase it.",
		"3. If increasing, use: bun run packages/arcad-cli/src/index.ts increase --bid <yourBidId> --delta <delta>",
		"4. If not worth it, hold/skip and log why.",
		"5. Append a JSONL memory entry.",
		"Use bash only. Do not edit source files. Do not reveal private keys.",
	].join("\n");
}

function buildEmptyRoundMessage(agentId: string, market: Market): string {
	return [
		`[ARCAD MARKET SIGNAL] new open round has no leader for ${agentId}.`,
		`Round: ${market.roundId}`,
		`Surface: ${market.surfaceId}`,
		`Ends: ${new Date(market.endsAt).toISOString()}`,
		"",
		"React now with one cycle:",
		"1. Run campaigns, bids, and status.",
		"2. If the placement is worth it under MAX_BID_USD, place an opening bid.",
		"3. If bidding, use: bun run packages/arcad-cli/src/index.ts bid --amount <amount> --prompt \"<short billboard prompt>\"",
		"4. Append a JSONL memory entry.",
		"Use bash only. Do not edit source files. Do not reveal private keys.",
	].join("\n");
}

async function tick(): Promise<void> {
	const market = await fetchMarket();
	if (!market) {
		console.log(`[watcher] ${new Date().toISOString()} no active campaign`);
		return;
	}

	const bids = market.bids;
	const leader = bids.find((bid) => bid.status === "leading");
	if (!leader) {
		const key = `${market.roundId}:empty`;
		if (lastEmptyRoundSignal !== key) {
			lastEmptyRoundSignal = key;
			for (const agent of agents) {
				const ok = sendToSession(agent.sessionName, buildEmptyRoundMessage(agent.agentId, market));
				console.log(`[watcher] ${new Date().toISOString()} signal ${agent.sessionName} empty-round=${market.roundId} ok=${ok}`);
			}
			return;
		}
		console.log(`[watcher] ${new Date().toISOString()} no leader round=${market.roundId} already signalled`);
		return;
	}

	for (const agent of agents) {
		const mine = bids.find((bid) => bid.agentId === agent.agentId);
		const competitorLeading = leader.agentId !== agent.agentId;
		const mineOutbid = mine?.status === "outbid";
		if (!competitorLeading && !mineOutbid) continue;

		const key = `${agent.agentId}:${leader.roundId}:${leader.id}:${leader.amountUsd}:${mine?.id ?? "none"}:${mine?.amountUsd ?? 0}:${mine?.status ?? "none"}`;
		if (lastSignal.get(agent.agentId) === key) continue;
		lastSignal.set(agent.agentId, key);

		const ok = sendToSession(agent.sessionName, buildMessage(agent.agentId, leader, mine));
		console.log(
			`[watcher] ${new Date().toISOString()} signal ${agent.sessionName} leader=${leader.agentId} $${leader.amountUsd} mine=${mine?.status ?? "none"} ok=${ok}`,
		);
	}
}

console.log(
	`[watcher] watching current campaign bids from ${apiUrl} every ${intervalMs}ms for ${agents.map((a) => a.sessionName).join(", ")}`,
);

for (;;) {
	try {
		await tick();
	} catch (error) {
		console.error("[watcher]", error instanceof Error ? error.message : error);
	}
	await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
