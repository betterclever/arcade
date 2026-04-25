import type { NextFunction, Request, Response } from "express";
import { config, isCirclePaymentsEnabled } from "../config";
import type { PaymentReceipt } from "../types";

type Middleware = (req: Request, res: Response, next: NextFunction) => void;

declare global {
  namespace Express {
    interface Request {
      arcadePayment?: PaymentReceipt;
      payment?: {
        payer?: string;
        amount?: string;
        network?: string;
        [key: string]: unknown;
      };
    }
  }
}

let circleGatewayPromise: Promise<{ require: (price: string) => Middleware } | null> | null = null;
let circleFacilitatorPromise: Promise<any | null> | null = null;
let supportedKindsPromise: Promise<any[] | null> | null = null;

const CIRCLE_BATCHING_NAME = "GatewayWalletBatched";
const CIRCLE_BATCHING_VERSION = "1";
const CIRCLE_BATCHING_SCHEME = "exact";

export async function paymentGuard(priceUsd: string): Promise<Middleware> {
  if (!isCirclePaymentsEnabled()) {
    return mockPaymentGuard(priceUsd);
  }

  const gateway = await getCircleGateway();
  if (!gateway) {
    console.warn("[payments] Circle x402 package unavailable; falling back to mock payments");
    return mockPaymentGuard(priceUsd);
  }

  const requirePayment = gateway.require(priceUsd);
  return (req, res, next) => {
    requirePayment(req, res, (err?: unknown) => {
      if (err) return next(err);
      const raw = req.payment;
      req.arcadePayment = {
        mode: "circle-x402",
        receiptId: `x402-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        payer: raw?.payer,
        network: raw?.network,
        amountUsd: priceToNumber(raw?.amount ?? priceUsd),
        raw,
      };
      next();
    });
  };
}

export function receiptFromRequest(req: Request, fallbackAmountUsd: number): PaymentReceipt {
  return (
    req.arcadePayment ?? {
      mode: "mock",
      receiptId: req.header("x-arcade-payment-receipt") ?? `mock-${crypto.randomUUID()}`,
      payer: req.header("x-arcade-agent-wallet") ?? undefined,
      network: "arc-testnet-mock",
      amountUsd: fallbackAmountUsd,
    }
  );
}

export async function bidAuthorizationGuard(amountFromRequest: (req: Request) => number): Promise<Middleware> {
  if (!isCirclePaymentsEnabled()) {
    return (req, _res, next) => {
      const amountUsd = amountFromRequest(req);
      req.arcadePayment = {
        mode: "mock",
        receiptId: req.header("x-arcade-payment-receipt") ?? `mock-${crypto.randomUUID()}`,
        payer: req.header("x-arcade-agent-wallet") ?? req.header("x-agent-id") ?? "demo-agent",
        network: "arc-testnet-mock",
        amountUsd,
        raw: { note: "Mock bid authorization. Circle mode verifies now and settles only the winning bid." },
      };
      next();
    };
  }

  return async (req, res, next) => {
    try {
      const amountUsd = amountFromRequest(req);
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        return res.status(400).json({ error: "Bid authorization amount must be positive" });
      }

      const paymentHeader = req.header("payment-signature");
      if (!paymentHeader) {
        const accepts = await createAllPaymentRequirements(amountUsd);
        if (accepts.length === 0) {
          return res.status(503).json({ error: "No Circle Gateway payment networks available" });
        }
        const paymentRequired = {
          x402Version: 2,
          resource: {
            url: req.originalUrl ?? req.url,
            description: "Arcad bid authorization",
            mimeType: "application/json",
          },
          accepts,
        };
        res.setHeader("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(paymentRequired)).toString("base64"));
        return res.status(402).json({});
      }

      const paymentPayload = JSON.parse(Buffer.from(paymentHeader, "base64").toString("utf-8"));
      const network = paymentPayload.accepted?.network;
      if (!network) return res.status(400).json({ error: "Missing accepted payment network" });
      const paymentRequirements = await createPaymentRequirements(amountUsd, network);
      if (!paymentRequirements) return res.status(400).json({ error: `Network ${network} is not accepted` });

      const facilitator = await getCircleFacilitator();
      if (!facilitator) return res.status(503).json({ error: "Circle Gateway facilitator unavailable" });
      const verifyResult = await facilitator.verify(paymentPayload, paymentRequirements);
      if (!verifyResult.isValid) {
        return res.status(402).json({
          error: "Payment authorization verification failed",
          reason: verifyResult.invalidReason,
        });
      }

      req.arcadePayment = {
        mode: "circle-x402",
        receiptId: `x402-auth-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        payer: verifyResult.payer,
        network,
        amountUsd,
        raw: {
          paymentPayload,
          paymentRequirements,
          verifyResult,
          paymentSignature: paymentHeader,
        },
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}

export async function settleReceipt(receipt: PaymentReceipt) {
  if (receipt.mode !== "circle-x402") {
    return { success: true, transaction: undefined, network: receipt.network, payer: receipt.payer, mock: true };
  }
  const raw = receipt.raw as any;
  if (!raw?.paymentPayload || !raw?.paymentRequirements) {
    return { success: false, errorReason: "Missing stored x402 payment payload" };
  }
  const facilitator = await getCircleFacilitator();
  if (!facilitator) return { success: false, errorReason: "Circle Gateway facilitator unavailable" };
  return facilitator.settle(raw.paymentPayload, raw.paymentRequirements);
}

function mockPaymentGuard(priceUsd: string): Middleware {
  return (req, _res, next) => {
    req.arcadePayment = {
      mode: "mock",
      receiptId: req.header("x-arcade-payment-receipt") ?? `mock-${crypto.randomUUID()}`,
      payer: req.header("x-arcade-agent-wallet") ?? req.header("x-agent-id") ?? "demo-agent",
      network: "arc-testnet-mock",
      amountUsd: priceToNumber(priceUsd),
      raw: {
        note: "Set PAYMENT_MODE=circle and SELLER_ADDRESS=0x... to require Circle x402 Nanopayments.",
      },
    };
    next();
  };
}

async function getCircleGateway() {
  if (!circleGatewayPromise) {
    circleGatewayPromise = import("@circle-fin/x402-batching/server")
      .then((mod) => {
        const createGatewayMiddleware = (mod as any).createGatewayMiddleware;
        if (!createGatewayMiddleware || !config.sellerAddress) return null;
        return createGatewayMiddleware({
          sellerAddress: config.sellerAddress,
          networks: config.acceptedNetworks,
          facilitatorUrl: config.circleGatewayFacilitatorUrl,
        });
      })
      .catch((error) => {
        console.warn("[payments] failed to load Circle Gateway middleware", error);
        return null;
      });
  }
  return circleGatewayPromise;
}

async function getCircleFacilitator() {
  if (!circleFacilitatorPromise) {
    circleFacilitatorPromise = import("@circle-fin/x402-batching/server")
      .then((mod) => {
        const BatchFacilitatorClient = (mod as any).BatchFacilitatorClient;
        if (!BatchFacilitatorClient) return null;
        return new BatchFacilitatorClient({ url: config.circleGatewayFacilitatorUrl });
      })
      .catch((error) => {
        console.warn("[payments] failed to load Circle Gateway facilitator", error);
        return null;
      });
  }
  return circleFacilitatorPromise;
}

async function createAllPaymentRequirements(amountUsd: number) {
  const networks = await getAcceptedKinds();
  const amount = dollarsToAtomic(amountUsd);
  return networks
    .map((kind) => ({ kind, asset: getUsdcAddress(kind) }))
    .filter((entry): entry is { kind: any; asset: string } => Boolean(entry.asset))
    .map(({ kind, asset }) => ({
      scheme: CIRCLE_BATCHING_SCHEME,
      network: kind.network,
      asset,
      amount,
      payTo: config.sellerAddress,
      maxTimeoutSeconds: Math.ceil(config.bidAuthorizationTtlMs / 1000),
      extra: {
        name: CIRCLE_BATCHING_NAME,
        version: CIRCLE_BATCHING_VERSION,
        verifyingContract: kind.extra.verifyingContract,
      },
    }));
}

async function createPaymentRequirements(amountUsd: number, network: string) {
  const networks = await getAcceptedKinds();
  const kind = networks.find((candidate) => candidate.network === network);
  const asset = kind ? getUsdcAddress(kind) : null;
  if (!kind || !asset) return null;
  return {
    scheme: CIRCLE_BATCHING_SCHEME,
    network: kind.network,
    asset,
    amount: dollarsToAtomic(amountUsd),
    payTo: config.sellerAddress,
    maxTimeoutSeconds: Math.ceil(config.bidAuthorizationTtlMs / 1000),
    extra: {
      name: CIRCLE_BATCHING_NAME,
      version: CIRCLE_BATCHING_VERSION,
      verifyingContract: kind.extra.verifyingContract,
    },
  };
}

async function getAcceptedKinds() {
  if (!supportedKindsPromise) {
    supportedKindsPromise = getCircleFacilitator().then(async (facilitator) => {
      if (!facilitator) return null;
      const supported = await facilitator.getSupported();
      return supported.kinds.filter((kind: any) => {
        const networkAccepted = config.acceptedNetworks.length === 0 || config.acceptedNetworks.includes(kind.network);
        return networkAccepted && kind.extra?.verifyingContract;
      });
    });
  }
  return (await supportedKindsPromise) ?? [];
}

function getUsdcAddress(kind: any) {
  const assets = kind.extra?.assets;
  if (!Array.isArray(assets)) return null;
  return assets.find((asset: any) => asset.symbol === "USDC")?.address ?? null;
}

function dollarsToAtomic(value: number) {
  return Math.round(value * 1_000_000).toString();
}

function priceToNumber(value: string | number) {
  if (typeof value === "number") return value;
  const parsed = Number(value.replace("$", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
