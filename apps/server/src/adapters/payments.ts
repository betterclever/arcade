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

function priceToNumber(value: string | number) {
  if (typeof value === "number") return value;
  const parsed = Number(value.replace("$", "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}
