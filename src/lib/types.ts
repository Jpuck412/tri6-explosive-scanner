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

export type QualityGrade = "A+" | "A" | "B" | "C";

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
  inlierPct: number;
}

export interface PatternEvidence {
  upperSlopePctPerBar: number;
  lowerSlopePctPerBar: number;
  upperR2: number;
  lowerR2: number;
  upperTouches: number;
  lowerTouches: number;
  upperInlierPct: number;
  lowerInlierPct: number;
  compressionPct: number;
  rangeCompressionPct: number;
  wickContainmentPct: number;
  bodyContainmentPct: number;
  violationPct: number;
  touchSpacingScore: number;
  alternationScore: number;
  apexProgressPct: number;
  apexBarsAway: number | null;
  breakoutDistancePct: number;
  invalidationDistancePct: number;
  currentWidthPct: number;
  formationBars: number;
  fitScore: number;
  touchScore: number;
  convergenceScore: number;
  compressionScore: number;
  containmentScore: number;
  structureScore: number;
  proximityScore: number;
}

export interface PatternProof {
  structure: string;
  confirmsAboveBelow: number;
  invalidatesAboveBelow: number;
  confirmation: string;
  invalidation: string;
}

export interface ChartPivot {
  offset: number;
  price: number;
  kind: Pivot["kind"];
}

export interface PatternResult {
  symbol: string;
  pattern: PatternType;
  direction: Direction;
  state: PatternState;
  score: number;
  grade: QualityGrade;
  fingerprint: string;
  price: number;
  upperBoundary: number;
  lowerBoundary: number;
  breakoutBoundary: number;
  invalidationBoundary: number;
  detectedAt: number;
  evidence: PatternEvidence;
  proof: PatternProof;
  chart: {
    candles: Pick<Candle, "t" | "o" | "h" | "l" | "c">[];
    upper: { start: number; end: number };
    lower: { start: number; end: number };
    pivots: ChartPivot[];
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
  minGrade?: QualityGrade;
  direction?: Direction | "ALL";
  patterns?: PatternType[];
  states?: PatternState[];
  maxResults?: number;
}

export interface ScanResponse {
  ok: true;
  engine: "TRI6_ELITE";
  engineVersion: string;
  generatedAt: number;
  provider: string;
  universeMode: "AUTO" | "SYMBOLS";
  timeframe: string;
  scanned: number;
  detected: number;
  matched: number;
  rejectedByFilters: number;
  elapsedMs: number;
  gradeCounts: Record<QualityGrade, number>;
  results: PatternResult[];
  failures: { symbol: string; reason: string }[];
}

export type ReplayOutcome = "PROOF_FIRST" | "INVALIDATION_FIRST" | "AMBIGUOUS" | "NEITHER";

export interface ReplayRequest {
  symbol: string;
  timespan?: "minute" | "hour" | "day";
  multiplier?: number;
  historyBars?: number;
  warmupBars?: number;
  evaluationBars?: number;
  stepBars?: number;
  minScore?: number;
  minGrade?: QualityGrade;
  states?: PatternState[];
  maxSignals?: number;
}

export interface ReplaySignal {
  detectedAt: number;
  pattern: PatternType;
  direction: Direction;
  state: PatternState;
  score: number;
  grade: QualityGrade;
  entryPrice: number;
  breakoutBoundary: number;
  invalidationBoundary: number;
  outcome: ReplayOutcome;
  proofBars: number | null;
  invalidationBars: number | null;
  mfePct: number;
  maePct: number;
  endReturnPct: number;
}

export interface ReplayPatternStats {
  signals: number;
  proofFirst: number;
  invalidationFirst: number;
  ambiguous: number;
  neither: number;
  proofFirstRatePct: number;
  avgMfePct: number;
  avgMaePct: number;
  avgEndReturnPct: number;
}

export interface ReplayResponse {
  ok: true;
  engine: "TRI6_ELITE";
  engineVersion: string;
  generatedAt: number;
  provider: string;
  symbol: string;
  timeframe: string;
  historyBars: number;
  warmupBars: number;
  evaluationBars: number;
  stepBars: number;
  elapsedMs: number;
  signals: ReplaySignal[];
  summary: ReplayPatternStats;
  byPattern: Partial<Record<PatternType, ReplayPatternStats>>;
}

export interface ApiError {
  ok: false;
  code: string;
  message: string;
  detail?: string;
  requestId?: string;
}

export interface EngineStatus {
  ok: true;
  engine: "TRI6_ELITE";
  version: string;
  providerConfigured: boolean;
  provider: string;
  liveDataOnly: true;
  scoreUsesOnlyGeometry: true;
  patterns: PatternType[];
  gates: {
    minScore: number;
    minLineR2: number;
    minBodyContainmentPct: number;
    minWickContainmentPct: number;
    minTouchSpacingScore: number;
    minAlternationScore: number;
    minCompressionPct: number;
    minFormationBars: number;
  };
}
