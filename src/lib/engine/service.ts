import { ENGINE_VERSION, scannerConfig } from "@/lib/config";
import { marketDataProvider } from "@/lib/provider";
import type { PatternResult, QualityGrade, ScanRequest, ScanResponse } from "@/lib/types";
import { detectPattern } from "./scan";

const gradeRank: Record<QualityGrade, number> = { "A+": 4, A: 3, B: 2, C: 1 };

function normalizeSymbols(symbols: string[] | undefined): string[] {
  if (!symbols?.length) return [];
  return [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "")).filter(Boolean))].slice(0, 250);
}

async function mapLimit<T, R>(items: T[], limit: number, mapper: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await mapper(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function timeframeLabel(timespan: "minute" | "hour" | "day", multiplier: number): string {
  if (timespan === "day") return `${multiplier}d`;
  if (timespan === "hour") return `${multiplier}h`;
  return `${multiplier}m`;
}

function sanitizedFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : "UNKNOWN_PROVIDER_ERROR";
  return message.replace(/apiKey=[^&\s]+/gi, "apiKey=REDACTED").slice(0, 180);
}

export async function runScan(request: ScanRequest): Promise<ScanResponse> {
  const started = Date.now();
  const requested = normalizeSymbols(request.symbols);
  const universeMode = requested.length ? "SYMBOLS" as const : "AUTO" as const;
  const universe = requested.length ? requested : (await marketDataProvider.universe()).map((item) => item.symbol);
  const timespan = request.timespan ?? "minute";
  const multiplier = Math.max(1, Math.min(60, Math.floor(request.multiplier ?? 1)));
  const lookbackBars = Math.max(60, Math.min(600, Math.floor(request.lookbackBars ?? scannerConfig.lookbackBars)));
  const minScore = Math.max(0, Math.min(100, request.minScore ?? scannerConfig.minScore));
  const minGrade = request.minGrade ?? "C";
  const maxResults = Math.max(1, Math.min(100, Math.floor(request.maxResults ?? 40)));
  const failures: { symbol: string; reason: string }[] = [];
  const scanned = await mapLimit(universe, scannerConfig.concurrency, async (symbol): Promise<PatternResult | null> => {
    try {
      const bars = await marketDataProvider.bars(symbol, { timespan, multiplier, lookbackBars });
      return detectPattern(symbol, bars, { lookbackBars });
    } catch (error) {
      failures.push({ symbol, reason: sanitizedFailure(error) });
      return null;
    }
  });
  const detected = scanned.filter((result): result is PatternResult => Boolean(result));
  const stateFilter = request.states?.length ? new Set(request.states) : null;
  const patternFilter = request.patterns?.length ? new Set(request.patterns) : null;
  const filtered = detected
    .filter((result) => result.score >= minScore)
    .filter((result) => gradeRank[result.grade] >= gradeRank[minGrade])
    .filter((result) => !request.direction || request.direction === "ALL" || result.direction === request.direction)
    .filter((result) => !stateFilter || stateFilter.has(result.state))
    .filter((result) => !patternFilter || patternFilter.has(result.pattern));
  const statePriority: Record<PatternResult["state"], number> = { CONFIRMED: 5, BREAKING: 4, READY: 3, COMPRESSED: 2, FORMING: 1 };
  const results = filtered.sort((a, b) => statePriority[b.state] - statePriority[a.state] || gradeRank[b.grade] - gradeRank[a.grade] || b.score - a.score || a.evidence.breakoutDistancePct - b.evidence.breakoutDistancePct).slice(0, maxResults);
  const gradeCounts: Record<QualityGrade, number> = { "A+": 0, A: 0, B: 0, C: 0 };
  for (const result of results) gradeCounts[result.grade] += 1;
  return {
    ok: true, engine: "TRI6_ELITE", engineVersion: ENGINE_VERSION, generatedAt: Date.now(), provider: marketDataProvider.name,
    universeMode, timeframe: timeframeLabel(timespan, multiplier), scanned: universe.length, detected: detected.length, matched: results.length,
    rejectedByFilters: Math.max(0, detected.length - filtered.length), elapsedMs: Date.now() - started, gradeCounts, results, failures: failures.slice(0, 30),
  };
}
