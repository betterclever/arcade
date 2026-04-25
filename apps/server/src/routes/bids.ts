import type { Router } from "express";
import { z } from "zod";
import { generateBillboardTexture } from "../adapters/gemini";
import { bidAuthorizationGuard, receiptFromRequest, settleReceipt } from "../adapters/payments";
import { config } from "../config";
import { store } from "../state/store";

const bidSchema = z.object({
  agentId: z.string().min(2),
  company: z.string().min(2),
  amountUsd: z.number().positive().max(config.maxBidUsd),
  prompt: z.string().min(10).max(600),
  rationale: z.string().max(800).default(""),
});

const increaseSchema = z.object({
  deltaUsd: z.number().positive().max(config.maxBidUsd),
});

export async function mountBidRoutes(router: Router) {
  const bidPayment = await bidAuthorizationGuard((req) => Number(req.body?.amountUsd));
  const increasePayment = await bidAuthorizationGuard((req) => Number(req.body?.deltaUsd));

  router.get("/surfaces/:surfaceId/bids", (req, res) => {
    res.json({ bids: store.listCurrentRoundBids(String(req.params.surfaceId)) });
  });

  router.get("/bids/:bidId", (req, res) => {
    const bid = store.getBid(String(req.params.bidId));
    if (!bid) return res.status(404).json({ error: "Bid not found" });
    res.json({
      bid,
      payments: store.listPayments(bid.surfaceId, bid.roundId, bid.id),
      refund: store.getBidRefundStatus(bid.id),
    });
  });

  router.get("/bids/:bidId/refund", (req, res) => {
    const bid = store.getBid(String(req.params.bidId));
    if (!bid) return res.status(404).json({ error: "Bid not found" });
    res.json({
      bidId: bid.id,
      ...store.getBidRefundStatus(bid.id),
      payments: store.listPayments(bid.surfaceId, bid.roundId, bid.id),
    });
  });

  router.post("/surfaces/:surfaceId/bids", bidPayment, (req, res, next) => {
    try {
      const input = bidSchema.parse(req.body);
      const bid = store.createBid({
        surfaceId: String(req.params.surfaceId),
        agentId: input.agentId,
        company: input.company,
        amountUsd: input.amountUsd,
        prompt: input.prompt,
        rationale: input.rationale,
        receipt: receiptFromRequest(req, input.amountUsd),
      });
      res.status(201).json({ bid });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/bids/:bidId/increase",
    (req, res, next) => {
      try {
        const status = store.getBidIncreaseStatus(String(req.params.bidId));
        if (!status.ok) return res.status(status.status).json({ error: status.error });
        next();
      } catch (error) {
        next(error);
      }
    },
    increasePayment,
    (req, res, next) => {
    try {
      const input = increaseSchema.parse(req.body);
      const bid = store.increaseBid(String(req.params.bidId), input.deltaUsd, receiptFromRequest(req, input.deltaUsd));
      res.json({ bid });
    } catch (error) {
      next(error);
    }
    },
  );

  router.post("/surfaces/:surfaceId/close-round", async (req, res, next) => {
    try {
      const surfaceId = String(req.params.surfaceId);
      const { round, winningBid } = store.closeRound(surfaceId);
      if (!winningBid) {
        store.completeRoundWithoutWinner(surfaceId, round.id);
        return res.json({ round, winningBid: null });
      }
      const settlement = await store.settleRoundPayments(round.id, winningBid.id, settleReceipt);

      const texture = await generateBillboardTexture({
        surfaceId,
        roundId: round.id,
        winningBid,
      });
      store.setTexture(texture);
      res.json({ round, winningBid, settlement, texture });
    } catch (error) {
      next(error);
    }
  });
}
