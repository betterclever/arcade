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
    res.json({
      surface,
      round: store.getCurrentRound(surface.id),
      bids: store.listCurrentRoundBids(surface.id),
      bidHistory: store.listBids(surface.id),
    });
  });
}
