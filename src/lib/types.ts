export type Direction = "BULLISH" | "BEARISH";

export type PatternType =
  | "ASCENDING_TRIANGLE"
  | "DESCENDING_TRIANGLE"
  | "BULLISH_SYMMETRICAL_TRIANGLE"
  | "BEARISH_SYMMETRICAL_TRIANGLE"
  | "FALLING_WEDGE"
  | "RISING_WEDGE";

export type PatternState =
  | "FORMING"
  | "COMPRESSED"
  | "READY"
  | "BREAKING"
  | "CONFIRMED";

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface Pivot {
  index: number;
  price: number;
  time: number;
  kind: "HIGH" | "LOW";
}

export interface TrendLine {
  slope: number;
  intercept: number;
  r2: number;
  meanErrorPct: number;
  points: number;
  touches: number;
}

export interface PatternEvidence {
  upperSlopePctPerBar: number;
  lowerSlopePctPerBar: number;
  upperR2: number;
  lowerR2: number;
  upperTouches: number;
  lowerTouches: number;
  compressionPct: number;
  containmentPct: number;
  apexProgressPct: number;
  breakoutDistancePct: number;
  currentWidthPct: number;
  fitScore: number;
  touchScore: number;
  convergenceScore: number;
  compressionScore: number;
  containmentScore: number;
  proximityScore: number;
}

export interface PatternResult {
  symbol: string;
  pattern: PatternType;
  direction: Direction;
  state: PatternState;
  score: number;
  price: number;
  upperBoundary: number;
  lowerBoundary: number;
  breakoutBoundary: number;
  invalidationBoundary: number;
  detectedAt: number;
  evidence: PatternEvidence;
  chart: {
    candles: Pick<Candle, "t" | "h" | "l" | "c">[];
    upper: { start: number; end: number };
    lower: { start: number; end: number };
  };
}

export interface UniverseTicker {
  symbol: string;
  price: number;
  dayVolume: number;
}

export interface ScanRequest {
  symbols?: string[];
  timespan?: "minute" | "hour" | "day";
  multiplier?: number;
  lookbackBars?: number;
  minScore?: number;
  direction?: Direction | "ALL";
  states?: PatternState[];
  maxResults?: number;
}

export interface ScanResponse {
  ok: true;
  generatedAt: number;
  provider: string;
  universeMode: "AUTO" | "SYMBOLS";
  scanned: number;
  matched: number;
  elapsedMs: number;
  results: PatternResult[];
  failures: { symbol: string; reason: string }[];
}

export interface ApiError {
  ok: false;
  code: string;
  message: string;
  detail?: string;
}
