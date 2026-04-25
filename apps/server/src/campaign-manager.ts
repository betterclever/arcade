import { generateBillboardTexture } from "./adapters/gemini";
import { settleReceipt } from "./adapters/payments";
import { config } from "./config";
import { store } from "./state/store";

const closingRounds = new Set<string>();

export function startCampaignManager() {
  if (!config.campaignManagerEnabled) {
    console.log("[campaign-manager] disabled");
    return;
  }

  const tick = () => {
    void closeExpiredRounds().catch((error) => {
      console.error("[campaign-manager]", error);
    });
  };

  tick();
  setInterval(tick, config.campaignManagerIntervalMs).unref();
  console.log(`[campaign-manager] enabled interval=${config.campaignManagerIntervalMs}ms`);
}

async function closeExpiredRounds() {
  const now = Date.now();
  for (const surface of store.listSurfaces()) {
    const round = store.getCurrentRound(surface.id);
    if (!round || round.status !== "open" || round.endsAt > now || closingRounds.has(round.id)) {
      continue;
    }

    closingRounds.add(round.id);
    try {
      const { round: closedRound, winningBid } = store.closeRound(surface.id);
      if (!winningBid) {
        store.completeRoundWithoutWinner(surface.id, closedRound.id);
        console.log(`[campaign-manager] closed empty round ${closedRound.id} for ${surface.id}`);
        continue;
      }

      const settlement = await store.settleRoundPayments(closedRound.id, winningBid.id, settleReceipt);
      const texture = await generateBillboardTexture({
        surfaceId: surface.id,
        roundId: closedRound.id,
        winningBid,
      });
      store.setTexture(texture);
      console.log(
        `[campaign-manager] closed round ${closedRound.id} winner=${winningBid.company} amount=${winningBid.amountUsd} settled=${settlement.settled.length} released=${settlement.released.length} failed=${settlement.failed.length}`,
      );
    } finally {
      closingRounds.delete(round.id);
    }
  }
}
