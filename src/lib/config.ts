function numberEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export const scannerConfig = {
  minPrice: numberEnv("SCANNER_MIN_PRICE", 0.1),
  maxPrice: numberEnv("SCANNER_MAX_PRICE", 20),
  minDayVolume: numberEnv("SCANNER_MIN_DAY_VOLUME", 100_000),
  maxUniverse: Math.max(10, Math.floor(numberEnv("SCANNER_MAX_UNIVERSE", 120))),
  concurrency: Math.max(1, Math.min(20, Math.floor(numberEnv("SCANNER_CONCURRENCY", 6)))),
  lookbackBars: Math.max(50, Math.floor(numberEnv("SCANNER_LOOKBACK_BARS", 160))),
  pivotWindow: Math.max(1, Math.floor(numberEnv("SCANNER_PIVOT_WINDOW", 2))),
  minPivotsPerSide: Math.max(2, Math.floor(numberEnv("SCANNER_MIN_PIVOTS_PER_SIDE", 3))),
  minScore: Math.max(0, Math.min(100, numberEnv("SCANNER_MIN_SCORE", 68))),
  touchTolerancePct: Math.max(0.05, numberEnv("SCANNER_LINE_TOUCH_TOLERANCE_PCT", 0.45)),
  horizontalSlopePctPerBar: Math.max(0.001, numberEnv("SCANNER_HORIZONTAL_SLOPE_PCT_PER_BAR", 0.035)),
  minSlopePctPerBar: Math.max(0.001, numberEnv("SCANNER_MIN_SLOPE_PCT_PER_BAR", 0.012)),
  readyDistancePct: Math.max(0.05, numberEnv("SCANNER_READY_DISTANCE_PCT", 0.65)),
  confirmBufferPct: Math.max(0.01, numberEnv("SCANNER_CONFIRM_BUFFER_PCT", 0.12)),
} as const;

export function providerKey(): string | null {
  return process.env.POLYGON_API_KEY?.trim() || process.env.MASSIVE_API_KEY?.trim() || null;
}

export function providerBaseUrl(): string {
  return (process.env.MARKET_DATA_BASE_URL || "https://api.polygon.io").replace(/\/$/, "");
}
