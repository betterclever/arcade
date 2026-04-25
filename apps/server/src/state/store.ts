import { nanoid } from "nanoid";
import { config } from "../config";
import type { AdSurface, AuctionRound, Bid, PaymentKind, PaymentLedgerEntry, PaymentReceipt, TextureUpdate } from "../types";
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
  payments: PaymentLedgerEntry[] = [];
  textures: TextureUpdate[] = [];

  constructor() {
    this.createSurface({
      id: "raceway-billboard-main",
      title: "Switchback Highway Billboard",
      game: "Arcad Drive",
      description: "Slow-roads inspired seasonal highway demo with a live roadside billboard visible from the driving line.",
      placement: "roadside-billboard",
      aspectRatio: config.geminiImageAspectRatio,
      dimensions: { width: 3168, height: 1344 },
      tags: ["driving", "roadside", "billboard", "seasonal", "agent-ads"],
      minBidUsd: 0.001,
      maxBidUsd: config.maxBidUsd,
      roundDurationMs: config.demoRoundDurationMs,
    });
  }

  createSurface(input: {
    id?: string;
    title: string;
    game: string;
    description?: string;
    placement?: string;
    aspectRatio?: string;
    dimensions?: {
      width: number;
      height: number;
    };
    tags?: string[];
    minBidUsd: number;
    maxBidUsd: number;
    roundDurationMs?: number;
  }) {
    const id = input.id ?? nanoid();
    const existingSurface = this.surfaces.get(id);
    if (existingSurface) {
      const updatedSurface: AdSurface = {
        ...existingSurface,
        title: input.title,
        game: input.game,
        description: input.description,
        placement: input.placement,
        aspectRatio: input.aspectRatio,
        dimensions: input.dimensions,
        tags: input.tags,
        minBidUsd: input.minBidUsd,
        maxBidUsd: input.maxBidUsd,
        roundDurationMs: input.roundDurationMs ?? existingSurface.roundDurationMs,
      };
      this.surfaces.set(id, updatedSurface);
      publish({ type: "surface.created", surface: updatedSurface });
      return updatedSurface;
    }
    const round = this.createRound(id, input.roundDurationMs ?? config.roundDurationMs);
    const surface: AdSurface = {
      id,
      title: input.title,
      game: input.game,
      description: input.description,
      placement: input.placement,
      aspectRatio: input.aspectRatio,
      dimensions: input.dimensions,
      tags: input.tags,
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

  listSurfaces() {
    return [...this.surfaces.values()];
  }

  getBid(bidId: string) {
    return this.bids.get(bidId);
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

  listRounds(surfaceId: string) {
    return [...this.rounds.values()]
      .filter((round) => round.surfaceId === surfaceId)
      .sort((a, b) => b.startsAt - a.startsAt);
  }

  getRound(roundId: string) {
    return this.rounds.get(roundId);
  }

  listPayments(surfaceId?: string, roundId?: string, bidId?: string) {
    return this.payments
      .filter((payment) => !surfaceId || payment.surfaceId === surfaceId)
      .filter((payment) => !roundId || payment.roundId === roundId)
      .filter((payment) => !bidId || payment.bidId === bidId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  getPayment(paymentId: string) {
    return this.payments.find((payment) => payment.id === paymentId);
  }

  getBidRefundStatus(bidId: string) {
    const bid = this.bids.get(bidId);
    if (!bid) throw new Error("Bid not found");
    const payments = this.listPayments(bid.surfaceId, bid.roundId, bid.id);
    if (bid.status === "won") {
      return {
        status: "settled",
        reason: "Winning bid authorizations are settled after round close.",
      };
    }
    if (payments.every((payment) => payment.settlementStatus === "released")) {
      return {
        status: "released",
        reason: "This bid lost the round, so its Circle Gateway authorizations were not settled.",
      };
    }
    return {
      status: "pending",
      reason: "Bid authorizations are held until the round closes. Only the winning bid is settled.",
    };
  }

  getSurfaceSnapshot(surfaceId: string) {
    const surface = this.requireSurface(surfaceId);
    const round = this.rounds.get(surface.currentRoundId);
    const rounds = this.listRounds(surfaceId);
    const closedRounds = rounds.filter((candidate) => candidate.status === "closed");
    const lastClosedRound = closedRounds[0];
    const lastWinner = lastClosedRound?.winningBidId ? this.bids.get(lastClosedRound.winningBidId) : undefined;
    return {
      surface,
      round,
      bids: this.listCurrentRoundBids(surfaceId),
      bidHistory: this.listBids(surfaceId),
      rounds,
      lastClosedRound,
      lastWinner,
      payments: this.listPayments(surfaceId),
      lastRoundPayments: lastClosedRound ? this.listPayments(surfaceId, lastClosedRound.id) : [],
    };
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
    this.recordPayment("bid-entry", bid, input.receipt);
    publish({ type: "bid.created", bid });
    return bid;
  }

  increaseBid(bidId: string, deltaUsd: number, receipt: PaymentReceipt) {
    const bid = this.bids.get(bidId);
    if (!bid) throw new Error("Bid not found");
    const surface = this.requireSurface(bid.surfaceId);
    const round = this.rounds.get(bid.roundId);
    if (!round || round.status !== "open" || surface.currentRoundId !== round.id) {
      throw new Error("Bid can only be increased while its round is open");
    }
    this.assertSameBidPayer(bid, receipt);
    const nextAmount = Number((bid.amountUsd + deltaUsd).toFixed(6));
    this.assertBidAmount(surface, nextAmount);
    bid.amountUsd = nextAmount;
    bid.paymentReceipt = receipt;
    bid.updatedAt = Date.now();
    this.refreshLeaders(bid.surfaceId);
    this.recordPayment("bid-increase", bid, receipt);
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
      this.listRoundBids(surfaceId, round.id).forEach((bid) => {
        if (bid.id !== winningBid.id) bid.status = "rejected";
      });
    }
    publish({ type: "round.closed", round, winningBid });
    return { round, winningBid };
  }

  async settleRoundPayments(
    roundId: string,
    winningBidId: string,
    settle: (receipt: PaymentReceipt) => Promise<any>,
  ) {
    const roundPayments = this.payments.filter((payment) => payment.roundId === roundId);
    const settled = [];
    const released = [];
    const failed = [];

    for (const payment of roundPayments) {
      const bid = this.bids.get(payment.bidId);
      if (payment.bidId !== winningBidId) {
        payment.settlementStatus = "released";
        payment.refundStatus = "released";
        payment.refundReason = "Losing bid authorization released without settlement.";
        released.push(payment);
        publish({ type: "payment.recorded", payment });
        continue;
      }

      if (!bid) {
        payment.settlementStatus = "settlement_failed";
        payment.refundReason = "Missing bid for winning payment.";
        failed.push(payment);
        publish({ type: "payment.recorded", payment });
        continue;
      }

      const receipt: PaymentReceipt = {
        mode: payment.mode,
        receiptId: payment.receiptId,
        payer: payment.payer,
        network: payment.network,
        amountUsd: payment.amountUsd,
        raw: payment.raw,
      };
      const result = await settle(receipt);
      if (result.success) {
        payment.settlementStatus = "settled";
        payment.refundStatus = "not_applicable";
        payment.refundReason = "Winning bid authorization settled.";
        payment.transaction = result.transaction ?? payment.transaction;
        payment.raw = { previous: payment.raw, settlement: result };
        settled.push(payment);
      } else {
        payment.settlementStatus = "settlement_failed";
        payment.refundStatus = "pending";
        payment.refundReason = result.errorReason ?? result.error ?? "Winning bid settlement failed.";
        payment.raw = { previous: payment.raw, settlement: result };
        failed.push(payment);
      }
      publish({ type: "payment.recorded", payment });
    }

    return { settled, released, failed };
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

  completeRoundWithoutWinner(surfaceId: string, roundId: string) {
    const surface = this.requireSurface(surfaceId);
    const round = this.rounds.get(roundId);
    if (!round) throw new Error("Round not found");
    if (surface.currentRoundId !== round.id) return round;
    round.status = "closed";
    const nextRound = this.createRound(surface.id, surface.roundDurationMs);
    surface.currentRoundId = nextRound.id;
    publish({ type: "round.closed", round });
    return round;
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
      throw new Error(`Arcad demo bids are capped at ${surface.maxBidUsd} USDC`);
    }
  }

  private assertSameBidPayer(bid: Bid, receipt: PaymentReceipt) {
    const existingPayer = this.payments.find((payment) => payment.bidId === bid.id)?.payer;
    if (!existingPayer || !receipt.payer) return;
    if (existingPayer.toLowerCase() !== receipt.payer.toLowerCase()) {
      throw new Error("Bid increases must be authorized by the same payer wallet as the original bid");
    }
  }

  private refreshLeaders(surfaceId: string) {
    const sorted = this.listCurrentRoundBids(surfaceId);
    sorted.forEach((bid, index) => {
      if (bid.status === "won" || bid.status === "rejected") return;
      bid.status = index === 0 ? "leading" : "outbid";
    });
  }

  private recordPayment(kind: PaymentKind, bid: Bid, receipt: PaymentReceipt) {
    const entry: PaymentLedgerEntry = {
      id: nanoid(),
      surfaceId: bid.surfaceId,
      roundId: bid.roundId,
      bidId: bid.id,
      agentId: bid.agentId,
      company: bid.company,
      kind,
      amountUsd: receipt.amountUsd,
      mode: receipt.mode,
      receiptId: receipt.receiptId,
      payer: receipt.payer,
      network: receipt.network,
      transaction: extractTransaction(receipt.raw),
      settlementStatus: receipt.mode === "mock" ? "mock-authorized" : "authorized",
      refundStatus: receipt.mode === "mock" ? "not_applicable" : "pending",
      refundReason: "Bid authorization is pending round close. Only the winning bid will be settled.",
      raw: receipt.raw,
      createdAt: Date.now(),
    };
    this.payments.push(entry);
    publish({ type: "payment.recorded", payment: entry });
    return entry;
  }
}

export const store = new AuctionStore();

function extractTransaction(raw: unknown) {
  if (!raw || typeof raw !== "object") return undefined;
  const transaction = (raw as { transaction?: unknown }).transaction;
  return typeof transaction === "string" ? transaction : undefined;
}
