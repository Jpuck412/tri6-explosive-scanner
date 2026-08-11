import { providerBaseUrl, providerKey, scannerConfig } from "@/lib/config";
import type { Candle, UniverseTicker } from "@/lib/types";

interface PolygonAggregate { t: number; o: number; h: number; l: number; c: number; v: number; }
interface PolygonSnapshotTicker { ticker?: string; lastTrade?: { p?: number }; min?: { c?: number }; day?: { c?: number; v?: number }; prevDay?: { c?: number }; }
interface PolygonResponse<T> { status?: string; results?: T; tickers?: PolygonSnapshotTicker[]; error?: string; message?: string; }
interface CacheEntry<T> { expires: number; value: T; }

const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

function pruneCache(now: number) {
  if (cache.size < scannerConfig.providerCacheMaxEntries) return;
  for (const [key, entry] of cache) {
    if (entry.expires <= now) cache.delete(key);
    if (cache.size < scannerConfig.providerCacheMaxEntries * 0.8) break;
  }
  if (cache.size >= scannerConfig.providerCacheMaxEntries) {
    const overflow = cache.size - Math.floor(scannerConfig.providerCacheMaxEntries * 0.75);
    let removed = 0;
    for (const key of cache.keys()) { cache.delete(key); removed += 1; if (removed >= overflow) break; }
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchAttempt<T>(url: string, attempt: number): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(scannerConfig.providerTimeoutMs), headers: { Accept: "application/json", "User-Agent": "TRI6-Elite/2" } });
  let payload: T & { error?: string; message?: string };
  try { payload = await response.json() as T & { error?: string; message?: string }; } catch { throw new Error(`PROVIDER_BAD_RESPONSE_${response.status}`); }
  if (response.ok) return payload;
  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt < scannerConfig.providerRetries) {
    const retryAfter = Number(response.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(10_000, retryAfter * 1_000) : Math.min(4_000, 350 * 2 ** attempt + Math.floor(Math.random() * 180));
    await sleep(backoff);
    return fetchAttempt<T>(url, attempt + 1);
  }
  const reason = payload.error || payload.message || `HTTP_${response.status}`;
  throw new Error(`PROVIDER_${String(reason).replace(/[^A-Za-z0-9_. -]/g, "").slice(0, 120)}`);
}

async function jsonFetch<T>(path: string, ttlMs: number): Promise<T> {
  const key = providerKey();
  if (!key) throw new Error("PROVIDER_NOT_CONFIGURED");
  const now = Date.now();
  const cached = cache.get(path);
  if (cached && cached.expires > now) return cached.value as T;
  const existing = inflight.get(path);
  if (existing) return existing as Promise<T>;
  const separator = path.includes("?") ? "&" : "?";
  const url = `${providerBaseUrl()}${path}${separator}apiKey=${encodeURIComponent(key)}`;
  const request = fetchAttempt<T>(url, 0).then((value) => { pruneCache(Date.now()); cache.set(path, { expires: Date.now() + ttlMs, value }); return value; }).finally(() => inflight.delete(path));
  inflight.set(path, request);
  return request;
}

function fromDateFor(timespan: "minute" | "hour" | "day", lookbackBars: number, multiplier: number): string {
  const now = new Date();
  const days = timespan === "day" ? Math.max(45, Math.ceil(lookbackBars * multiplier * 1.8)) : timespan === "hour" ? Math.max(12, Math.ceil(lookbackBars * multiplier / 5)) : Math.max(5, Math.ceil(lookbackBars * multiplier / 60 / 6.5) + 6);
  now.setUTCDate(now.getUTCDate() - days);
  return now.toISOString().slice(0, 10);
}

function cleanBars(results: PolygonAggregate[], lookbackBars: number): Candle[] {
  const byTime = new Map<number, Candle>();
  for (const bar of results) {
    if (![bar.t, bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite)) continue;
    if (!(bar.h >= Math.max(bar.o, bar.c)) || !(bar.l <= Math.min(bar.o, bar.c)) || bar.c <= 0) continue;
    byTime.set(bar.t, { t: bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: Math.max(0, bar.v) });
  }
  return [...byTime.values()].sort((a, b) => a.t - b.t).slice(-lookbackBars);
}

export class PolygonProvider {
  readonly name = "POLYGON_COMPATIBLE_LIVE";
  configured(): boolean { return Boolean(providerKey()); }
  async universe(): Promise<UniverseTicker[]> {
    const payload = await jsonFetch<PolygonResponse<unknown>>("/v2/snapshot/locale/us/markets/stocks/tickers", 20_000);
    return (payload.tickers ?? [])
      .map((item): UniverseTicker | null => {
        const symbol = item.ticker?.trim().toUpperCase();
        const price = item.lastTrade?.p ?? item.min?.c ?? item.day?.c ?? 0;
        const dayVolume = item.day?.v ?? 0;
        if (!symbol || !Number.isFinite(price) || !Number.isFinite(dayVolume) || !/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol)) return null;
        return { symbol, price, dayVolume };
      })
      .filter((item): item is UniverseTicker => Boolean(item))
      .filter((item) => item.price >= scannerConfig.minPrice && item.price <= scannerConfig.maxPrice)
      .filter((item) => item.dayVolume >= scannerConfig.minDayVolume)
      .sort((a, b) => b.dayVolume - a.dayVolume)
      .slice(0, scannerConfig.maxUniverse);
  }
  async bars(symbol: string, options: { timespan: "minute" | "hour" | "day"; multiplier: number; lookbackBars: number }): Promise<Candle[]> {
    const safeSymbol = symbol.toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
    if (!safeSymbol) throw new Error("INVALID_SYMBOL");
    const from = fromDateFor(options.timespan, options.lookbackBars, options.multiplier);
    const to = new Date().toISOString().slice(0, 10);
    const path = `/v2/aggs/ticker/${encodeURIComponent(safeSymbol)}/range/${options.multiplier}/${options.timespan}/${from}/${to}?adjusted=true&sort=asc&limit=50000`;
    const payload = await jsonFetch<PolygonResponse<PolygonAggregate[]>>(path, 7_000);
    const bars = cleanBars(payload.results ?? [], options.lookbackBars);
    if (bars.length < Math.min(60, options.lookbackBars)) throw new Error("INSUFFICIENT_BARS");
    return bars;
  }
}
