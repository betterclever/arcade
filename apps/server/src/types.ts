export type BidStatus = "pending" | "leading" | "outbid" | "won" | "rejected";

export interface AdSurface {
  id: string;
  title: string;
  game: string;
  minBidUsd: number;
  maxBidUsd: number;
  roundDurationMs: number;
  textureUrl: string;
  currentRoundId: string;
  createdAt: number;
}

export interface Bid {
  id: string;
  surfaceId: string;
  roundId: string;
  agentId: string;
  company: string;
  amountUsd: number;
  prompt: string;
  rationale: string;
  status: BidStatus;
  paid: boolean;
  paymentReceipt?: PaymentReceipt;
  createdAt: number;
  updatedAt: number;
}

export interface PaymentReceipt {
  mode: "mock" | "circle-x402";
  receiptId: string;
  payer?: string;
  network?: string;
  amountUsd: number;
  raw?: unknown;
}

export type PaymentKind = "bid-entry" | "bid-increase";
export type PaymentSettlementStatus = "mock-settled" | "settled";
export type PaymentRefundStatus = "not_refundable" | "refunded";

export interface PaymentLedgerEntry {
  id: string;
  surfaceId: string;
  roundId: string;
  bidId: string;
  agentId: string;
  company: string;
  kind: PaymentKind;
  amountUsd: number;
  mode: PaymentReceipt["mode"];
  receiptId: string;
  payer?: string;
  network?: string;
  transaction?: string;
  settlementStatus: PaymentSettlementStatus;
  refundStatus: PaymentRefundStatus;
  refundReason: string;
  raw?: unknown;
  createdAt: number;
}

export interface AuctionRound {
  id: string;
  surfaceId: string;
  startsAt: number;
  endsAt: number;
  status: "open" | "rendering" | "closed";
  winningBidId?: string;
  finalTextureUrl?: string;
}

export interface TextureUpdate {
  surfaceId: string;
  roundId: string;
  bidId: string;
  textureUrl: string;
  prompt: string;
  generatedBy: "mock" | "gemini";
  imageHash: string;
  createdAt: number;
}

export type ArcadeEvent =
  | { type: "surface.created"; surface: AdSurface }
  | { type: "bid.created"; bid: Bid }
  | { type: "bid.increased"; bid: Bid; deltaUsd: number }
  | { type: "payment.recorded"; payment: PaymentLedgerEntry }
  | { type: "round.closed"; round: AuctionRound; winningBid?: Bid }
  | { type: "texture.updated"; update: TextureUpdate };
