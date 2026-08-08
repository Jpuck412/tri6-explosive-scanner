import { scannerConfig } from "@/lib/config";
import { lineValue } from "@/lib/math/linearRegression";
import type { Candle, Direction, PatternEvidence, PatternResult, PatternState } from "@/lib/types";
import { classifyShape } from "./classify";
import { buildGeometry } from "./geometry";
import { findPivots, recentPivots } from "./pivots";

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const round = (value: number, decimals = 2) => Number(value.toFixed(decimals));

function computeBias(candles: Candle[], upperBoundary: number, lowerBoundary: number): boolean {
  const last = candles.at(-1);
  if (!last) return true;
  const width = upperBoundary - lowerBoundary;
  if (width <= 0) return true;

  const position = (last.c - lowerBoundary) / width;
  const recent = candles.slice(-8);
  const first = recent[0]?.c ?? last.c;
  const momentum = first ? (last.c - first) / first : 0;
  return position >= 0.53 || (position >= 0.47 && momentum >= 0);
}

function patternState(
  candles: Candle[],
  direction: Direction,
  upperBoundary: number,
  lowerBoundary: number,
  compressionPct: number,
  distancePct: number,
): PatternState {
  const last = candles.at(-1);
  const prev = candles.at(-2);
  if (!last || !prev) return "FORMING";

  const buffer = scannerConfig.confirmBufferPct / 100;
  if (direction === "BULLISH") {
    const confirmed = last.c > upperBoundary * (1 + buffer) && prev.c > upperBoundary * (1 + buffer * 0.3);
    if (confirmed) return "CONFIRMED";
    if (last.c > upperBoundary) return "BREAKING";
  } else {
    const confirmed = last.c < lowerBoundary * (1 - buffer) && prev.c < lowerBoundary * (1 - buffer * 0.3);
    if (confirmed) return "CONFIRMED";
    if (last.c < lowerBoundary) return "BREAKING";
  }

  if (distancePct <= scannerConfig.readyDistancePct && compressionPct >= 45) return "READY";
  if (compressionPct >= 45) return "COMPRESSED";
  return "FORMING";
}

function createEvidence(params: {
  upperSlopePctPerBar: number;
  lowerSlopePctPerBar: number;
  upperR2: number;
  lowerR2: number;
  upperErrorPct: number;
  lowerErrorPct: number;
  upperTouches: number;
  lowerTouches: number;
  compressionPct: number;
  containmentPct: number;
  apexProgressPct: number;
  breakoutDistancePct: number;
  currentWidthPct: number;
}): PatternEvidence {
  const meanLineErrorPct = (params.upperErrorPct + params.lowerErrorPct) / 2;
  const fitScore = clamp(100 - (meanLineErrorPct / Math.max(0.05, scannerConfig.touchTolerancePct)) * 82);
  const touchScore = clamp(((Math.min(params.upperTouches, 4) + Math.min(params.lowerTouches, 4)) / 8) * 100);
  const convergenceScore = clamp(params.apexProgressPct <= 115 ? 100 - Math.abs(78 - params.apexProgressPct) * 1.2 : 35);
  const compressionScore = clamp(params.compressionPct * 1.35);
  const containmentScore = clamp((params.containmentPct - 50) * 2);
  const proximityScore = clamp(100 - params.breakoutDistancePct * 35);

  return {
    upperSlopePctPerBar: round(params.upperSlopePctPerBar, 4),
    lowerSlopePctPerBar: round(params.lowerSlopePctPerBar, 4),
    upperR2: round(params.upperR2, 3),
    lowerR2: round(params.lowerR2, 3),
    upperTouches: params.upperTouches,
    lowerTouches: params.lowerTouches,
    compressionPct: round(params.compressionPct, 1),
    containmentPct: round(params.containmentPct, 1),
    apexProgressPct: round(params.apexProgressPct, 1),
    breakoutDistancePct: round(params.breakoutDistancePct, 3),
    currentWidthPct: round(params.currentWidthPct, 3),
    fitScore: round(fitScore, 1),
    touchScore: round(touchScore, 1),
    convergenceScore: round(convergenceScore, 1),
    compressionScore: round(compressionScore, 1),
    containmentScore: round(containmentScore, 1),
    proximityScore: round(proximityScore, 1),
  };
}

function weightedScore(e: PatternEvidence): number {
  // Geometry-only score. No volume, catalyst, oscillator or indicator inputs.
  return round(clamp(
    e.fitScore * 0.22 +
    e.touchScore * 0.18 +
    e.convergenceScore * 0.16 +
    e.compressionScore * 0.18 +
    e.containmentScore * 0.14 +
    e.proximityScore * 0.12,
  ), 1);
}

export function detectPattern(symbol: string, rawCandles: Candle[]): PatternResult | null {
  const candles = rawCandles
    .filter((bar) => [bar.o, bar.h, bar.l, bar.c].every(Number.isFinite) && bar.h >= bar.l && bar.c > 0)
    .slice(-scannerConfig.lookbackBars);

  if (candles.length < 50) return null;

  const pivots = findPivots(candles, scannerConfig.pivotWindow);
  const upperPivots = recentPivots(pivots, "HIGH", 7);
  const lowerPivots = recentPivots(pivots, "LOW", 7);
  const geometry = buildGeometry(candles, upperPivots, lowerPivots);
  if (!geometry) return null;

  const endIndex = candles.length - 1;
  const price = geometry.referencePrice;
  const upperBoundary = lineValue(geometry.upper.slope, geometry.upper.intercept, endIndex);
  const lowerBoundary = lineValue(geometry.lower.slope, geometry.lower.intercept, endIndex);
  if (!(upperBoundary > lowerBoundary) || price <= 0) return null;

  const upperSlopePctPerBar = geometry.upper.slope / price * 100;
  const lowerSlopePctPerBar = geometry.lower.slope / price * 100;
  const bullishBias = computeBias(candles, upperBoundary, lowerBoundary);
  const shape = classifyShape({ upperSlopePctPerBar, lowerSlopePctPerBar, bullishBias });
  if (!shape) return null;

  // Apex must be ahead of the pattern start; structures that already crossed are invalid.
  if (geometry.apexIndex !== null && geometry.apexIndex <= endIndex - 3) return null;
  if (geometry.apexProgressPct < 18 || geometry.apexProgressPct > 125) return null;

  const breakoutBoundary = shape.direction === "BULLISH" ? upperBoundary : lowerBoundary;
  const invalidationBoundary = shape.direction === "BULLISH" ? lowerBoundary : upperBoundary;
  const breakoutDistancePct = Math.abs(price - breakoutBoundary) / price * 100;
  const currentWidthPct = geometry.currentWidth / price * 100;

  const evidence = createEvidence({
    upperSlopePctPerBar,
    lowerSlopePctPerBar,
    upperR2: geometry.upper.r2,
    lowerR2: geometry.lower.r2,
    upperErrorPct: geometry.upper.meanErrorPct,
    lowerErrorPct: geometry.lower.meanErrorPct,
    upperTouches: geometry.upper.touches,
    lowerTouches: geometry.lower.touches,
    compressionPct: geometry.compressionPct,
    containmentPct: geometry.containmentPct,
    apexProgressPct: geometry.apexProgressPct,
    breakoutDistancePct,
    currentWidthPct,
  });

  if (evidence.upperTouches < 2 || evidence.lowerTouches < 2) return null;
  if (evidence.containmentPct < 55 || evidence.fitScore < 45 || evidence.compressionPct < 18) return null;

  const score = weightedScore(evidence);
  const state = patternState(candles, shape.direction, upperBoundary, lowerBoundary, geometry.compressionPct, breakoutDistancePct);
  const chartBars = candles.slice(-48);
  const chartStartIndex = candles.length - chartBars.length;

  return {
    symbol,
    pattern: shape.pattern,
    direction: shape.direction,
    state,
    score,
    price: round(price, 4),
    upperBoundary: round(upperBoundary, 4),
    lowerBoundary: round(lowerBoundary, 4),
    breakoutBoundary: round(breakoutBoundary, 4),
    invalidationBoundary: round(invalidationBoundary, 4),
    detectedAt: candles.at(-1)?.t ?? Date.now(),
    evidence,
    chart: {
      candles: chartBars.map(({ t, h, l, c }) => ({ t, h, l, c })),
      upper: {
        start: lineValue(geometry.upper.slope, geometry.upper.intercept, chartStartIndex),
        end: upperBoundary,
      },
      lower: {
        start: lineValue(geometry.lower.slope, geometry.lower.intercept, chartStartIndex),
        end: lowerBoundary,
      },
    },
  };
}
