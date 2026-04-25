import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

type WakeState = {
	active: boolean;
	intervalMs: number;
	count: number;
	timer?: NodeJS.Timeout;
};

const DEFAULT_INTERVAL_MS = 15_000;
const MIN_INTERVAL_MS = 5_000;

function parseIntervalMs(): number {
	const raw = process.env.ARCAD_PI_WAKE_MS ?? process.env.BID_WAKE_MS ?? "";
	const parsed = Number(raw);
	if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_INTERVAL_MS;
	return Math.max(MIN_INTERVAL_MS, Math.trunc(parsed));
}

function buildWakePrompt(count: number): string {
	const agentId = process.env.AGENT_ID ?? "arcad-agent";
	const company = process.env.COMPANY_NAME ?? agentId;
	const maxBid = process.env.MAX_BID_USD ?? "0.01";
	const apiUrl = process.env.ARCADE_API_URL ?? "http://localhost:8787/api";
	const brandCategory = process.env.BRAND_CATEGORY ?? "AI company";
	const brandProfile = process.env.BRAND_PROFILE ?? "Create a crisp, high-conversion AI billboard for technical founders.";

	return [
		`[ARCAD WAKE ${count}]`,
		`You are still ${company} (${agentId}), an autonomous Arcad bidder.`,
		`Brand category: ${brandCategory}`,
		`Brand profile: ${brandProfile}`,
		"",
		"Do one bidding cycle now:",
		"1. Inspect campaigns, bids, and status with:",
		"   bun run packages/arcad-cli/src/index.ts campaigns",
		"   bun run packages/arcad-cli/src/index.ts bids",
		"   bun run packages/arcad-cli/src/index.ts status",
		"2. Read your memory file:",
		`   tail -20 /tmp/arcad-agent-memory/${agentId}.jsonl || true`,
		"3. Decide whether to bid, increase, hold, or skip.",
		"4. If bidding, create a fresh rich billboard prompt yourself and use:",
		"   bun run packages/arcad-cli/src/index.ts bid --amount <amount> --prompt \"<21:9 billboard creative prompt>\"",
		"5. If increasing, use:",
		"   bun run packages/arcad-cli/src/index.ts increase --bid <bidId> --delta <delta>",
		`6. Never let your total bid exceed MAX_BID_USD=${maxBid}.`,
		"7. Append one JSONL memory entry with at, roundId, observedLeader, myBidStatus, decision, amount/delta, prompt, and reason.",
		"8. Vary the creative from memory: headline, scene, product metaphor, palette, mood, and SF AI audience angle.",
		"Prompt must describe the ad image, not just the company name. Keep text readable from a moving car.",
		"",
		`Arcad API: ${apiUrl}`,
		"Use bash only. Do not edit source files. Do not reveal private keys.",
	].join("\n");
}

function updateStatus(ctx: ExtensionContext, state: WakeState): void {
	if (!ctx.hasUI) return;
	const label = state.active ? `arcad wakes ${state.count} @ ${Math.round(state.intervalMs / 1000)}s` : undefined;
	ctx.ui.setStatus("arcad-waker", label);
}

export default function arcadWaker(pi: ExtensionAPI): void {
	const state: WakeState = {
		active: process.env.ARCAD_PI_WAKE !== "0",
		intervalMs: parseIntervalMs(),
		count: 0,
	};

	function clearWake(): void {
		if (state.timer) clearTimeout(state.timer);
		state.timer = undefined;
	}

	function scheduleWake(ctx: ExtensionContext): void {
		clearWake();
		if (!state.active) return;

		state.timer = setTimeout(() => {
			if (!state.active || ctx.hasPendingMessages()) {
				scheduleWake(ctx);
				return;
			}

			state.count += 1;
			pi.appendEntry("arcad-waker", {
				at: new Date().toISOString(),
				count: state.count,
				agentId: process.env.AGENT_ID,
				company: process.env.COMPANY_NAME,
			});
			updateStatus(ctx, state);

			pi.sendMessage(
				{
					customType: "arcad-waker",
					content: buildWakePrompt(state.count),
					display: true,
				},
				{
					deliverAs: "followUp",
					triggerTurn: true,
				},
			);
		}, state.intervalMs);
	}

	pi.registerCommand("arcad-waker", {
		description: "Toggle the Arcad autonomous bidding wake loop",
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();
			if (command === "off" || command === "stop") {
				state.active = false;
				clearWake();
				updateStatus(ctx, state);
				ctx.ui.notify("Arcad wake loop stopped", "info");
				return;
			}

			if (command === "on" || command === "start" || command === "") {
				state.active = true;
				updateStatus(ctx, state);
				scheduleWake(ctx);
				ctx.ui.notify("Arcad wake loop active", "info");
				return;
			}

			const seconds = Number(command);
			if (Number.isFinite(seconds) && seconds > 0) {
				state.intervalMs = Math.max(MIN_INTERVAL_MS, Math.trunc(seconds * 1000));
				state.active = true;
				updateStatus(ctx, state);
				scheduleWake(ctx);
				ctx.ui.notify(`Arcad wake loop every ${Math.round(state.intervalMs / 1000)}s`, "info");
				return;
			}

			ctx.ui.notify("Usage: /arcad-waker [on|off|seconds]", "warning");
		},
	});

	pi.on("session_start", async () => {
		const agentId = process.env.AGENT_ID ?? "arcad-agent";
		pi.setSessionName(`arcad-${agentId}`);
	});

	pi.on("before_agent_start", async (_event, ctx) => {
		updateStatus(ctx, state);
		return {
			message: {
				customType: "arcad-waker-context",
				display: false,
				content:
					"Arcad waker is loaded. You are an autonomous bidder. Complete exactly one inspect/decide/bid-or-hold cycle per wake, then stop and wait for the next wake.",
			},
		};
	});

	pi.on("agent_end", async (_event, ctx) => {
		scheduleWake(ctx);
	});

	pi.on("session_shutdown", async () => {
		clearWake();
	});
}
