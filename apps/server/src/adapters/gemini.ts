import { createHash } from "node:crypto";
import { config } from "../config";
import type { Bid, TextureUpdate } from "../types";

export async function generateBillboardTexture(input: {
  surfaceId: string;
  roundId: string;
  winningBid: Bid;
}): Promise<TextureUpdate> {
  const prompt = buildBillboardPrompt(input.winningBid);

  if (config.googleApiKey) {
    try {
      const textureUrl = await generateWithGemini(prompt);
      return makeUpdate(input, textureUrl, "gemini");
    } catch (error) {
      console.warn("[gemini] image generation failed; using SVG fallback", error);
    }
  }

  return makeUpdate(input, renderMockBillboard(input.winningBid), "mock");
}

function buildBillboardPrompt(bid: Bid) {
  return [
    "Create a clean 16:9 in-game racing billboard texture.",
    `Advertiser: ${bid.company}.`,
    `Creative direction: ${bid.prompt}`,
    "The billboard must be legible from a moving car, brand-safe, high contrast, with no tiny body copy.",
    "Use a polished game-ad look, not a poster mockup. Keep text short.",
  ].join(" ");
}

async function generateWithGemini(prompt: string) {
  const { GoogleGenAI } = (await import("@google/genai")) as any;
  const ai = new GoogleGenAI({ apiKey: config.googleApiKey });
  const response = await ai.models.generateContent({
    model: config.geminiImageModel,
    contents: prompt,
  });

  const parts = response?.candidates?.[0]?.content?.parts ?? response?.parts ?? [];
  const imagePart = parts.find((part: any) => part.inlineData?.data);
  if (!imagePart?.inlineData?.data) {
    throw new Error("Gemini response did not include inline image data");
  }

  const mimeType = imagePart.inlineData.mimeType ?? "image/png";
  return `data:${mimeType};base64,${imagePart.inlineData.data}`;
}

function makeUpdate(
  input: { surfaceId: string; roundId: string; winningBid: Bid },
  textureUrl: string,
  generatedBy: "mock" | "gemini",
): TextureUpdate {
  return {
    surfaceId: input.surfaceId,
    roundId: input.roundId,
    bidId: input.winningBid.id,
    textureUrl,
    prompt: input.winningBid.prompt,
    generatedBy,
    imageHash: createHash("sha256").update(textureUrl).digest("hex"),
    createdAt: Date.now(),
  };
}

function renderMockBillboard(bid: Bid) {
  const palette = pickPalette(bid.company);
  const title = escapeXml(bid.company.toUpperCase()).slice(0, 26);
  const line = escapeXml(shortLine(bid.prompt)).slice(0, 64);
  const amount = `$${bid.amountUsd.toFixed(3)} BID`;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900">
  <defs>
    <linearGradient id="sky" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="${palette.bgA}"/>
      <stop offset="1" stop-color="${palette.bgB}"/>
    </linearGradient>
    <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
  </defs>
  <rect width="1600" height="900" fill="url(#sky)"/>
  <rect width="1600" height="900" opacity=".12" filter="url(#grain)"/>
  <path d="M-40 690 C260 545 520 760 840 622 C1110 506 1314 426 1640 506 L1640 900 L-40 900 Z" fill="${palette.ground}"/>
  <circle cx="1320" cy="190" r="148" fill="${palette.accent}" opacity=".88"/>
  <rect x="88" y="98" width="1120" height="104" rx="16" fill="#f8fafc"/>
  <text x="124" y="170" fill="#111827" font-family="Arial, sans-serif" font-size="64" font-weight="800">${title}</text>
  <text x="106" y="370" fill="#f8fafc" font-family="Arial, sans-serif" font-size="94" font-weight="800">${line}</text>
  <rect x="108" y="694" width="300" height="76" rx="14" fill="${palette.accent}"/>
  <text x="138" y="745" fill="#111827" font-family="Arial, sans-serif" font-size="34" font-weight="800">${amount}</text>
  <text x="1120" y="764" fill="#f8fafc" font-family="Arial, sans-serif" font-size="30" font-weight="700">ARCAD</text>
</svg>`;

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function shortLine(prompt: string) {
  const cleaned = prompt.replace(/\s+/g, " ").trim();
  const sentence = cleaned.split(/[.!?]/)[0] || cleaned;
  return sentence.length > 42 ? `${sentence.slice(0, 39)}...` : sentence;
}

function pickPalette(seed: string) {
  const palettes = [
    { bgA: "#0f172a", bgB: "#334155", ground: "#115e59", accent: "#facc15" },
    { bgA: "#172554", bgB: "#0369a1", ground: "#1f2937", accent: "#67e8f9" },
    { bgA: "#3f1d2b", bgB: "#7f1d1d", ground: "#111827", accent: "#fda4af" },
    { bgA: "#052e16", bgB: "#166534", ground: "#0f172a", accent: "#86efac" },
  ];
  const index = [...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palettes.length;
  return palettes[index];
}

function escapeXml(value: string) {
  return value.replace(/[<>&'"]/g, (char) => {
    const map: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return map[char] ?? char;
  });
}
