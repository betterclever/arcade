import express from "express";
import cors from "cors";
import { ZodError } from "zod";
import { config, isCirclePaymentsEnabled } from "./config";
import { mountAgentRoutes } from "./routes/agents";
import { mountBidRoutes } from "./routes/bids";
import { mountEventRoutes } from "./routes/events";
import { mountSurfaceRoutes } from "./routes/surfaces";
import { startCampaignManager } from "./campaign-manager";
import { getDatabasePath } from "./state/db";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const router = express.Router();
mountEventRoutes(router);
mountSurfaceRoutes(router);
mountAgentRoutes(router);
await mountBidRoutes(router);

app.use("/api", router);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    name: "Arcad auction server",
    paymentMode: isCirclePaymentsEnabled() ? "circle-x402" : "mock",
    arcNetwork: "eip155:5042002",
    databasePath: getDatabasePath(),
  });
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ error: "Invalid request", issues: error.issues });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error";
  console.error("[server]", error);
  res.status(500).json({ error: message });
});

app.listen(config.port, () => {
  console.log(`Arcad auction server listening on http://localhost:${config.port}`);
  console.log(`Payment mode: ${isCirclePaymentsEnabled() ? "Circle x402 Nanopayments" : "mock demo payments"}`);
  startCampaignManager();
});
