import { providerBaseUrl, providerKey, scannerConfig } from "@/lib/config";
import type { Candle, UniverseTicker } from "@/lib/types";

interface PolygonAggregate {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface PolygonSnapshotTicker {
  ticker?: string;
  lastTrade?: { p?: number };
  min?: { c?: number };
  day?: { c?: number; v?: number };
  prevDay?: { c?: number };
}

interface PolygonResponse<T> {
  status?: string;
  results?: T;
  tickers?: PolygonSnapshotTicker[];
  error?: string;
  message?: string;
}

const cache = new Map<string, { expires: number; value: unknown }>();

async function jsonFetch<T>(path: string, ttlMs: number): Promise<T> {
  const key = providerKey();
  if (!key) throw new Error("PROVIDER_NOT_CONFIGURED");

  const cacheKey = path;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.value as T;

  const separator = path.includes("?") ? "&" : "?";
  const response = await fetch(`${providerBaseUrl()}${path}${separator}apiKey=${encodeURIComponent(key)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
    headers: { Accept: "application/json" },
  });

  const payload = await response.json() as T & { error?: string; message?: string };
  if (!response.ok) {
    throw new Error(payload.error || payload.message || `Provider HTTP ${response.status}`);
  }

  cache.set(cacheKey, { expires: Date.now() + ttlMs, value: payload });
  return payload;
}

function fromDateFor(timespan: "minute" | "hour" | "day", lookbackBars: number, multiplier: number): string {
  const now = new Date();
  const days = timespan === "day"
    ? Math.max(45, Math.ceil(lookbackBars * multiplier * 1.8))
    : timespan === "hour"
      ? Math.max(12, Math.ceil(lookbackBars * multiplier / 5))
      : Math.max(5, Math.ceil(lookbackBars * multiplier / 60 / 6.5) + 4);
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString().slice(0, 10);
}

export class PolygonProvider {
  readonly name = "POLYGON_COMPATIBLE_LIVE";

  configured(): boolean {
    return Boolean(providerKey());
  }

  async universe(): Promise<UniverseTicker[]> {
    const payload = await jsonFetch<PolygonResponse<unknown>>(
      "/v2/snapshot/locale/us/markets/stocks/tickers",
      20_000,
    );

    const tickers = payload.tickers ?? [];
    return tickers
      .map((item): UniverseTicker | null => {
        const symbol = item.ticker?.trim().toUpperCase();
        const price = item.lastTrade?.p ?? item.min?.c ?? item.day?.c ?? 0;
        const dayVolume = item.day?.v ?? 0;
        if (!symbol || !Number.isFinite(price) || !Number.isFinite(dayVolume)) return null;
        return { symbol, price, dayVolume };
      })
      .filter((item): item is UniverseTicker => Boolean(item))
      .filter((item) => item.price >= scannerConfig.minPrice && item.price <= scannerConfig.maxPrice)
      .filter((item) => item.dayVolume >= scannerConfig.minDayVolume)
      .sort((a, b) => b.dayVolume - a.dayVolume)
      .slice(0, scannerConfig.maxUniverse);
  }

  async bars(
    symbol: string,
    options: { timespan: "minute" | "hour" | "day"; multiplier: number; lookbackBars: number },
  ): Promise<Candle[]> {
    const safeSymbol = symbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!safeSymbol) throw new Error("INVALID_SYMBOL");

    const from = fromDateFor(options.timespan, options.lookbackBars, options.multiplier);
    const to = new Date().toISOString().slice(0, 10);
    const path = `/v2/aggs/ticker/${encodeURIComponent(safeSymbol)}/range/${options.multiplier}/${options.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000`;
    const payload = await jsonFetch<PolygonResponse<PolygonAggregate[]>>(path, 8_000);
    const results = payload.results ?? [];

    return results
      .filter((bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite))
      .map((bar) => ({ t: bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v }))
      .slice(-options.lookbackBars);
  }
}
