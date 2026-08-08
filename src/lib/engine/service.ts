import { scannerConfig } from "@/lib/config";
import { marketDataProvider } from "@/lib/provider";
import type { PatternResult, ScanRequest, ScanResponse } from "@/lib/types";
import { detectPattern } from "./scan";

function normalizeSymbols(symbols: string[] | undefined): string[] {
  if (!symbols?.length) return [];
  return [...new Set(
    symbols
      .map((symbol) => symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
      .filter(Boolean),
  )].slice(0, 250);
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await mapper(item);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function runScan(request: ScanRequest): Promise<ScanResponse> {
  const started = Date.now();
  const requested = normalizeSymbols(request.symbols);
  const universeMode = requested.length ? "SYMBOLS" as const : "AUTO" as const;
  const universe = requested.length
    ? requested
    : (await marketDataProvider.universe()).map((item) => item.symbol);

  const timespan = request.timespan ?? "minute";
  const multiplier = Math.max(1, Math.min(60, Math.floor(request.multiplier ?? 1)));
  const lookbackBars = Math.max(50, Math.min(600, Math.floor(request.lookbackBars ?? scannerConfig.lookbackBars)));
  const minScore = Math.max(0, Math.min(100, request.minScore ?? scannerConfig.minScore));
  const maxResults = Math.max(1, Math.min(100, Math.floor(request.maxResults ?? 40)));
  const failures: { symbol: string; reason: string }[] = [];

  const scanned = await mapLimit(universe, scannerConfig.concurrency, async (symbol): Promise<PatternResult | null> => {
    try {
      const bars = await marketDataProvider.bars(symbol, { timespan, multiplier, lookbackBars });
      return detectPattern(symbol, bars);
    } catch (error) {
      failures.push({ symbol, reason: error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR" });
      return null;
    }
  });

  const stateFilter = request.states?.length ? new Set(request.states) : null;
  const results = scanned
    .filter((result): result is PatternResult => Boolean(result))
    .filter((result) => result.score >= minScore)
    .filter((result) => !request.direction || request.direction === "ALL" || result.direction === request.direction)
    .filter((result) => !stateFilter || stateFilter.has(result.state))
    .sort((a, b) => {
      const statePriority: Record<PatternResult["state"], number> = {
        CONFIRMED: 5,
        BREAKING: 4,
        READY: 3,
        COMPRESSED: 2,
        FORMING: 1,
      };
      return statePriority[b.state] - statePriority[a.state] || b.score - a.score;
    })
    .slice(0, maxResults);

  return {
    ok: true,
    generatedAt: Date.now(),
    provider: marketDataProvider.name,
    universeMode,
    scanned: universe.length,
    matched: results.length,
    elapsedMs: Date.now() - started,
    results,
    failures: failures.slice(0, 20),
  };
}
