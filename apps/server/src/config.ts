export const config = {
  port: Number(process.env.PORT ?? 8787),
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:8787",
  paymentMode: (process.env.PAYMENT_MODE ?? "mock") as "mock" | "circle",
  sellerAddress: process.env.SELLER_ADDRESS,
  acceptedNetworks: (process.env.X402_NETWORKS ?? "eip155:5042002")
    .split(",")
    .map((network) => network.trim())
    .filter(Boolean),
  bidEntryFeeUsd: process.env.BID_ENTRY_FEE_USD ?? "$0.001",
  bidIncreaseFeeUsd: process.env.BID_INCREASE_FEE_USD ?? "$0.001",
  googleApiKey: process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY,
  geminiImageModel: process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image-preview",
  roundDurationMs: Number(process.env.ROUND_DURATION_MS ?? 5 * 60 * 1000),
  demoRoundDurationMs: Number(process.env.DEMO_ROUND_DURATION_MS ?? 30 * 1000),
};

export function isCirclePaymentsEnabled() {
  return config.paymentMode === "circle" && Boolean(config.sellerAddress);
}
