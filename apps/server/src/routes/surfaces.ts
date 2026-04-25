import type { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { store } from "../state/store";

const createSurfaceSchema = z.object({
  id: z.string().min(2).optional(),
  title: z.string().min(2),
  game: z.string().min(2),
  description: z.string().min(2).optional(),
  placement: z.string().min(2).optional(),
  aspectRatio: z.string().min(3).optional(),
  dimensions: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }).optional(),
  tags: z.array(z.string().min(1)).optional(),
  minBidUsd: z.number().positive().default(0.001),
  maxBidUsd: z.number().positive().max(config.maxBidUsd).default(config.maxBidUsd),
  roundDurationMs: z.number().int().min(10_000).optional(),
});

export function mountSurfaceRoutes(router: Router) {
  router.get("/surfaces", (_req, res) => {
    res.json({
      surfaces: [...store.surfaces.values()],
    });
  });

  router.get("/games", (_req, res) => {
    const games = [...store.surfaces.values()].reduce<Array<{
      id: string;
      title: string;
      surfaces: Array<{
        id: string;
        title: string;
        description?: string;
        placement?: string;
        aspectRatio?: string;
        dimensions?: { width: number; height: number };
        currentRoundId: string;
        minBidUsd: number;
        maxBidUsd: number;
      }>;
    }>>((acc, surface) => {
      const id = slugify(surface.game);
      let game = acc.find((entry) => entry.id === id);
      if (!game) {
        game = { id, title: surface.game, surfaces: [] };
        acc.push(game);
      }
      game.surfaces.push({
        id: surface.id,
        title: surface.title,
        description: surface.description,
        placement: surface.placement,
        aspectRatio: surface.aspectRatio,
        dimensions: surface.dimensions,
        currentRoundId: surface.currentRoundId,
        minBidUsd: surface.minBidUsd,
        maxBidUsd: surface.maxBidUsd,
      });
      return acc;
    }, []);
    res.json({ games });
  });

  router.get("/campaigns", (_req, res) => {
    const campaigns = [...store.surfaces.values()].map((surface) => {
      const snapshot = store.getSurfaceSnapshot(surface.id);
      const leadingBid = snapshot.bids[0] ?? null;
      return {
        id: `${surface.id}:${snapshot.round?.id ?? "no-round"}`,
        game: surface.game,
        surface,
        round: snapshot.round,
        status: snapshot.round?.status ?? "unknown",
        startsAt: snapshot.round?.startsAt,
        endsAt: snapshot.round?.endsAt,
        minBidUsd: surface.minBidUsd,
        maxBidUsd: surface.maxBidUsd,
        creativeSpec: {
          placement: surface.placement,
          aspectRatio: surface.aspectRatio,
          width: surface.dimensions?.width,
          height: surface.dimensions?.height,
          imageSize: config.geminiImageSize,
          promptHint: "Generate a legible in-game billboard texture only. Avoid poster mockups, dense body copy, tiny disclaimers, or UI chrome.",
        },
        leadingBid,
        bidCount: snapshot.bids.length,
        lastWinner: snapshot.lastWinner ?? null,
      };
    });
    res.json({ campaigns });
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

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
