import type { Router } from "express";
import { z } from "zod";
import { store } from "../state/store";

const quoteSchema = z.object({
  surfaceId: z.string().default("raceway-billboard-main"),
  agentId: z.string().min(2),
  company: z.string().min(2),
  maxBidUsd: z.number().positive().max(0.01),
  valuePerImpressionUsd: z.number().positive().default(0.00002),
  expectedImpressions: z.number().int().positive().default(250),
});

export function mountAgentRoutes(router: Router) {
  router.post("/agents/quote", (req, res, next) => {
    try {
      const input = quoteSchema.parse(req.body);
      const surface = store.getSurface(input.surfaceId);
      if (!surface) return res.status(404).json({ error: "Surface not found" });

      const currentLeader = store.listCurrentRoundBids(surface.id)[0];
      const estimatedValue = input.valuePerImpressionUsd * input.expectedImpressions;
      const nextBid = Number(
        Math.min(
          input.maxBidUsd,
          surface.maxBidUsd,
          Math.max(surface.minBidUsd, (currentLeader?.amountUsd ?? 0) + 0.001),
        ).toFixed(6),
      );

      res.json({
        surface,
        currentLeader,
        shouldBid: nextBid <= estimatedValue && nextBid <= input.maxBidUsd,
        suggestedBidUsd: nextBid,
        estimatedValueUsd: Number(estimatedValue.toFixed(6)),
        reason:
          nextBid <= estimatedValue
            ? "Expected exposure value clears the current auction price."
            : "Current clearing price is above this agent's expected value.",
      });
    } catch (error) {
      next(error);
    }
  });
}
