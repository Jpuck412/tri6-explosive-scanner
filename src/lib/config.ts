function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

const pct = (name: string, fallback: number, min = 0, max = 100) =>
  Math.max(min, Math.min(max, numberEnv(name, fallback)));

export const ENGINE_VERSION = "2.0.0";

export const scannerConfig = {
  minPrice: numberEnv("SCANNER_MIN_PRICE", 0.1),
  maxPrice: numberEnv("SCANNER_MAX_PRICE", 20),
  minDayVolume: numberEnv("SCANNER_MIN_DAY_VOLUME", 100_000),
  maxUniverse: Math.max(10, Math.min(500, Math.floor(numberEnv("SCANNER_MAX_UNIVERSE", 240)))),
  concurrency: Math.max(1, Math.min(20, Math.floor(numberEnv("SCANNER_CONCURRENCY", 8)))),
  lookbackBars: Math.max(60, Math.min(600, Math.floor(numberEnv("SCANNER_LOOKBACK_BARS", 180)))),
  pivotWindow: Math.max(1, Math.min(8, Math.floor(numberEnv("SCANNER_PIVOT_WINDOW", 2)))),
  pivotPoolPerSide: Math.max(5, Math.min(14, Math.floor(numberEnv("SCANNER_PIVOT_POOL_PER_SIDE", 9)))),
  minPivotsPerSide: Math.max(2, Math.min(8, Math.floor(numberEnv("SCANNER_MIN_PIVOTS_PER_SIDE", 3)))),
  touchTolerancePct: pct("SCANNER_LINE_TOUCH_TOLERANCE_PCT", 0.45, 0.05, 4),
  horizontalSlopePctPerBar: pct("SCANNER_HORIZONTAL_SLOPE_PCT_PER_BAR", 0.035, 0.001, 1),
  minSlopePctPerBar: pct("SCANNER_MIN_SLOPE_PCT_PER_BAR", 0.012, 0.001, 1),
  minScore: pct("SCANNER_MIN_SCORE", 72),
  minLineR2: Math.max(0, Math.min(1, numberEnv("SCANNER_MIN_LINE_R2", 0.42))),
  minCompressionPct: pct("SCANNER_MIN_COMPRESSION_PCT", 22),
  minRangeCompressionPct: pct("SCANNER_MIN_RANGE_COMPRESSION_PCT", 8),
  minWickContainmentPct: pct("SCANNER_MIN_WICK_CONTAINMENT_PCT", 58),
  minBodyContainmentPct: pct("SCANNER_MIN_BODY_CONTAINMENT_PCT", 74),
  maxViolationPct: pct("SCANNER_MAX_VIOLATION_PCT", 22),
  minTouchSpacingScore: pct("SCANNER_MIN_TOUCH_SPACING_SCORE", 36),
  minAlternationScore: pct("SCANNER_MIN_ALTERNATION_SCORE", 34),
  minFormationBars: Math.max(10, Math.min(120, Math.floor(numberEnv("SCANNER_MIN_FORMATION_BARS", 18)))),
  maxFormationBars: Math.max(30, Math.min(300, Math.floor(numberEnv("SCANNER_MAX_FORMATION_BARS", 150)))),
  minApexProgressPct: pct("SCANNER_MIN_APEX_PROGRESS_PCT", 18),
  maxApexProgressPct: pct("SCANNER_MAX_APEX_PROGRESS_PCT", 122),
  readyDistancePct: pct("SCANNER_READY_DISTANCE_PCT", 0.65, 0.05, 10),
  confirmBufferPct: pct("SCANNER_CONFIRM_BUFFER_PCT", 0.12, 0.01, 5),
  strongCloseThresholdPct: pct("SCANNER_STRONG_CLOSE_THRESHOLD_PCT", 64, 50, 95),
  providerTimeoutMs: Math.max(2_000, Math.min(30_000, Math.floor(numberEnv("PROVIDER_TIMEOUT_MS", 12_000)))),
  providerRetries: Math.max(0, Math.min(4, Math.floor(numberEnv("PROVIDER_RETRIES", 2)))),
  providerCacheMaxEntries: Math.max(100, Math.min(20_000, Math.floor(numberEnv("PROVIDER_CACHE_MAX_ENTRIES", 4_000)))),
} as const;

export function providerKey(): string | null {
  return process.env.POLYGON_API_KEY?.trim() || process.env.MASSIVE_API_KEY?.trim() || null;
}

export function providerBaseUrl(): string {
  return (process.env.MARKET_DATA_BASE_URL || "https://api.polygon.io").replace(/\/$/, "");
}
