import type { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { generateBillboardTexture } from "../adapters/gemini";
import { paymentGuard, receiptFromRequest } from "../adapters/payments";
import { store } from "../state/store";

const bidSchema = z.object({
  agentId: z.string().min(2),
  company: z.string().min(2),
  amountUsd: z.number().positive().max(0.01),
  prompt: z.string().min(10).max(600),
  rationale: z.string().max(800).default(""),
});

const increaseSchema = z.object({
  deltaUsd: z.number().positive().max(0.01),
});

export async function mountBidRoutes(router: Router) {
  const bidPayment = await paymentGuard(config.bidEntryFeeUsd);
  const increasePayment = await paymentGuard(config.bidIncreaseFeeUsd);

  router.get("/surfaces/:surfaceId/bids", (req, res) => {
    res.json({ bids: store.listCurrentRoundBids(String(req.params.surfaceId)) });
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
        receipt: receiptFromRequest(req, 0.001),
      });
      res.status(201).json({ bid });
    } catch (error) {
      next(error);
    }
  });

  router.patch("/bids/:bidId/increase", increasePayment, (req, res, next) => {
    try {
      const input = increaseSchema.parse(req.body);
      const bid = store.increaseBid(String(req.params.bidId), input.deltaUsd, receiptFromRequest(req, 0.001));
      res.json({ bid });
    } catch (error) {
      next(error);
    }
  });

  router.post("/surfaces/:surfaceId/close-round", async (req, res, next) => {
    try {
      const surfaceId = String(req.params.surfaceId);
      const { round, winningBid } = store.closeRound(surfaceId);
      if (!winningBid) {
        return res.json({ round, winningBid: null });
      }

      const texture = await generateBillboardTexture({
        surfaceId,
        roundId: round.id,
        winningBid,
      });
      store.setTexture(texture);
      res.json({ round, winningBid, texture });
    } catch (error) {
      next(error);
    }
  });
}
