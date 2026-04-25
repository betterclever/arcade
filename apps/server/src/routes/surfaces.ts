import type { Router } from "express";
import { z } from "zod";
import { store } from "../state/store";

const createSurfaceSchema = z.object({
  id: z.string().min(2).optional(),
  title: z.string().min(2),
  game: z.string().min(2),
  minBidUsd: z.number().positive().default(0.001),
  maxBidUsd: z.number().positive().max(0.01).default(0.01),
  roundDurationMs: z.number().int().min(10_000).optional(),
});

export function mountSurfaceRoutes(router: Router) {
  router.get("/surfaces", (_req, res) => {
    res.json({
      surfaces: [...store.surfaces.values()],
    });
  });

  router.post("/surfaces", (req, res, next) => {
    try {
      const input = createSurfaceSchema.parse(req.body);
      const surface = store.createSurface(input);
      res.status(201).json({ surface });
    } catch (error) {
      next(error);
    }
  });

  router.get("/surfaces/:surfaceId", (req, res) => {
    const surface = store.getSurface(req.params.surfaceId);
    if (!surface) return res.status(404).json({ error: "Surface not found" });
    res.json(store.getSurfaceSnapshot(surface.id));
  });

  router.get("/surfaces/:surfaceId/rounds", (req, res) => {
    const surface = store.getSurface(req.params.surfaceId);
    if (!surface) return res.status(404).json({ error: "Surface not found" });
    res.json({ rounds: store.listRounds(surface.id) });
  });

  router.get("/surfaces/:surfaceId/payments", (req, res) => {
    const surface = store.getSurface(req.params.surfaceId);
    if (!surface) return res.status(404).json({ error: "Surface not found" });
    res.json({ payments: store.listPayments(surface.id) });
  });

  router.get("/rounds/:roundId", (req, res) => {
    const round = store.getRound(req.params.roundId);
    if (!round) return res.status(404).json({ error: "Round not found" });
    const winningBid = round.winningBidId ? store.bids.get(round.winningBidId) : undefined;
    res.json({
      round,
      bids: store.listRoundBids(round.surfaceId, round.id),
      winningBid,
      payments: store.listPayments(round.surfaceId, round.id),
    });
  });

  router.get("/payments/:paymentId", (req, res) => {
    const payment = store.getPayment(req.params.paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json({ payment });
  });
}
