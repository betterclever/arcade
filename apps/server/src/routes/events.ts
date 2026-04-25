import type { Router } from "express";
import { addEventClient } from "../state/event-bus";

export function mountEventRoutes(router: Router) {
  router.get("/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", req.header("origin") ?? "*");
    addEventClient(res);
  });
}
