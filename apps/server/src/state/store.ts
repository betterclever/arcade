import { nanoid } from "nanoid";
import { config } from "../config";
import type { AdSurface, AuctionRound, Bid, PaymentReceipt, TextureUpdate } from "../types";
import { publish } from "./event-bus";

const defaultTexture =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <rect width="1600" height="900" fill="#1f2933"/>
  <path d="M0 680 C350 570 520 760 860 620 C1120 515 1270 450 1600 510 L1600 900 L0 900 Z" fill="#0f766e"/>
  <text x="90" y="160" fill="#f8fafc" font-family="Arial, sans-serif" font-size="92" font-weight="700">ARCAD</text>
  <text x="94" y="242" fill="#cbd5e1" font-family="Arial, sans-serif" font-size="36">agent-bid game ads live on Arc</text>
  <rect x="92" y="690" width="430" height="72" rx="10" fill="#f8fafc"/>
  <text x="122" y="738" fill="#111827" font-family="Arial, sans-serif" font-size="34" font-weight="700">OPEN AUCTION</text>
</svg>`);

class AuctionStore {
  surfaces = new Map<string, AdSurface>();
  rounds = new Map<string, AuctionRound>();
  bids = new Map<string, Bid>();
  textures: TextureUpdate[] = [];

  constructor() {
    this.createSurface({
      id: "raceway-billboard-main",
      title: "Main Raceway Billboard",
      game: "Arcad Speedway",
      minBidUsd: 0.001,
      maxBidUsd: 0.01,
      roundDurationMs: config.demoRoundDurationMs,
    });
  }

  createSurface(input: {
    id?: string;
    title: string;
    game: string;
    minBidUsd: number;
    maxBidUsd: number;
    roundDurationMs?: number;
  }) {
    const id = input.id ?? nanoid();
    const round = this.createRound(id, input.roundDurationMs ?? config.roundDurationMs);
    const surface: AdSurface = {
      id,
      title: input.title,
      game: input.game,
      minBidUsd: input.minBidUsd,
      maxBidUsd: input.maxBidUsd,
      roundDurationMs: input.roundDurationMs ?? config.roundDurationMs,
      textureUrl: defaultTexture,
      currentRoundId: round.id,
      createdAt: Date.now(),
    };
    this.surfaces.set(id, surface);
    publish({ type: "surface.created", surface });
    return surface;
  }

  createRound(surfaceId: string, durationMs: number) {
    const now = Date.now();
    const round: AuctionRound = {
      id: nanoid(),
      surfaceId,
      startsAt: now,
      endsAt: now + durationMs,
      status: "open",
    };
    this.rounds.set(round.id, round);
    return round;
  }

  getSurface(surfaceId: string) {
    return this.surfaces.get(surfaceId);
  }

  getCurrentRound(surfaceId: string) {
    const surface = this.requireSurface(surfaceId);
    return this.rounds.get(surface.currentRoundId);
  }

  listBids(surfaceId: string) {
    return [...this.bids.values()]
      .filter((bid) => bid.surfaceId === surfaceId)
      .sort((a, b) => b.amountUsd - a.amountUsd || a.createdAt - b.createdAt);
  }

  listCurrentRoundBids(surfaceId: string) {
    const round = this.getCurrentRound(surfaceId);
    if (!round) return [];
    return this.listRoundBids(surfaceId, round.id);
  }

  listRoundBids(surfaceId: string, roundId: string) {
    return [...this.bids.values()]
      .filter((bid) => bid.surfaceId === surfaceId && bid.roundId === roundId)
      .sort((a, b) => b.amountUsd - a.amountUsd || a.createdAt - b.createdAt);
  }

  createBid(input: {
    surfaceId: string;
    agentId: string;
    company: string;
    amountUsd: number;
    prompt: string;
    rationale: string;
    receipt: PaymentReceipt;
  }) {
    const surface = this.requireSurface(input.surfaceId);
    const round = this.rounds.get(surface.currentRoundId);
    if (!round || round.status !== "open") {
      throw new Error("Auction round is not open");
    }
    this.assertBidAmount(surface, input.amountUsd);

    const now = Date.now();
    const bid: Bid = {
      id: nanoid(),
      surfaceId: input.surfaceId,
      roundId: round.id,
      agentId: input.agentId,
      company: input.company,
      amountUsd: input.amountUsd,
      prompt: input.prompt,
      rationale: input.rationale,
      status: "pending",
      paid: true,
      paymentReceipt: input.receipt,
      createdAt: now,
      updatedAt: now,
    };

    this.bids.set(bid.id, bid);
    this.refreshLeaders(input.surfaceId);
    publish({ type: "bid.created", bid });
    return bid;
  }

  increaseBid(bidId: string, deltaUsd: number, receipt: PaymentReceipt) {
    const bid = this.bids.get(bidId);
    if (!bid) throw new Error("Bid not found");
    const surface = this.requireSurface(bid.surfaceId);
    const nextAmount = Number((bid.amountUsd + deltaUsd).toFixed(6));
    this.assertBidAmount(surface, nextAmount);
    bid.amountUsd = nextAmount;
    bid.paymentReceipt = receipt;
    bid.updatedAt = Date.now();
    this.refreshLeaders(bid.surfaceId);
    publish({ type: "bid.increased", bid, deltaUsd });
    return bid;
  }

  closeRound(surfaceId: string) {
    const surface = this.requireSurface(surfaceId);
    const round = this.rounds.get(surface.currentRoundId);
    if (!round) throw new Error("Round not found");
    const winningBid = this.listRoundBids(surfaceId, round.id)[0];
    round.status = "rendering";
    if (winningBid) {
      winningBid.status = "won";
      round.winningBidId = winningBid.id;
    }
    publish({ type: "round.closed", round, winningBid });
    return { round, winningBid };
  }

  setTexture(update: TextureUpdate) {
    const surface = this.requireSurface(update.surfaceId);
    surface.textureUrl = update.textureUrl;
    const round = this.rounds.get(update.roundId);
    if (round) {
      round.status = "closed";
      round.finalTextureUrl = update.textureUrl;
      const nextRound = this.createRound(surface.id, surface.roundDurationMs);
      surface.currentRoundId = nextRound.id;
    }
    this.textures.push(update);
    publish({ type: "texture.updated", update });
    return update;
  }

  private requireSurface(surfaceId: string) {
    const surface = this.surfaces.get(surfaceId);
    if (!surface) throw new Error("Surface not found");
    return surface;
  }

  private assertBidAmount(surface: AdSurface, amountUsd: number) {
    if (amountUsd < surface.minBidUsd) {
      throw new Error(`Bid must be at least ${surface.minBidUsd} USDC`);
    }
    if (amountUsd > surface.maxBidUsd) {
      throw new Error(`Hackathon demo bids are capped at ${surface.maxBidUsd} USDC`);
    }
  }

  private refreshLeaders(surfaceId: string) {
    const sorted = this.listCurrentRoundBids(surfaceId);
    sorted.forEach((bid, index) => {
      if (bid.status === "won" || bid.status === "rejected") return;
      bid.status = index === 0 ? "leading" : "outbid";
    });
  }
}

export const store = new AuctionStore();
