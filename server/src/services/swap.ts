import { config } from "../config.js";

let cache: { rate: number; at: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Resolve the live mid rate (DUYS per 1 USDT) from the configured source
 * (e.g. DexScreener pair endpoint). Caches briefly to avoid hammering the
 * upstream. Falls back to SWAP_MID_RATE_FALLBACK when unset/unreachable.
 */
export async function fetchMidRate(): Promise<number> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rate;
  let rate = config.swapMidRateFallback;
  if (config.midRateUrl) {
    try {
      const res = await fetch(config.midRateUrl, {
        headers: config.midRateApiKey ? { Authorization: `Bearer ${config.midRateApiKey}` } : {},
      });
      if (res.ok) {
        const body = await res.json().catch(() => ({}));
        rate = parseRate(body);
      }
    } catch {
      rate = config.swapMidRateFallback;
    }
  }
  if (!Number.isFinite(rate) || rate <= 0) rate = config.swapMidRateFallback;
  cache = { rate, at: Date.now() };
  return rate;
}

/** Best-effort extraction of a DUYS-per-USDT number from common payload shapes. */
function parseRate(body: unknown): number {
  if (!body || typeof body !== "object") return config.swapMidRateFallback;
  const b = body as Record<string, unknown>;

  // DexScreener: {"pairs":[{ "priceUsd": "..." }]}
  const pairs = Array.isArray(b.pairs) ? (b.pairs as Record<string, unknown>[]) : null;
  if (pairs && pairs.length > 0) {
    const p = pairs[0];
    const v = Number(p.priceUsd);
    if (Number.isFinite(v) && v > 0) return v;
  }
  // Generic shapes.
  for (const k of ["rate", "mid", "midRate", "price", "priceUsd"]) {
    const v = Number((b as Record<string, unknown>)[k]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return config.swapMidRateFallback;
}

export function applySpread(mid: number, side: "buy" | "sell") {
  const s = config.swapSpread / 100;
  return side === "buy" ? mid * (1 + s) : mid * (1 - s);
}

export function toAmount(mid: number, side: "buy" | "sell", fromAmount: number) {
  const rate = applySpread(mid, side);
  // Buying DUYS with USDT -> convert USDT to DUYS at the buy rate.
  // Selling DUYS for USDT -> convert DUYS to USDT at the sell rate.
  return side === "buy" ? fromAmount / rate : fromAmount * rate;
}