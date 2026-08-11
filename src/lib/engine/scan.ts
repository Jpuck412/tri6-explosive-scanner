import { scannerConfig } from "@/lib/config";
import { lineValue } from "@/lib/math/linearRegression";
import type { Candle, Direction, PatternEvidence, PatternProof, PatternResult, PatternType, QualityGrade, TrendLine } from "@/lib/types";
import { classifyShape } from "./classify";
import { buildGeometry } from "./geometry";
import { findPivots, recentPivots } from "./pivots";
import { classifyPatternState } from "./state";

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

function effectiveLinePass(line: TrendLine, slopePctPerBar: number): boolean {
  const isHorizontal = Math.abs(slopePctPerBar) <= scannerConfig.horizontalSlopePctPerBar;
  if (isHorizontal) return line.meanErrorPct <= scannerConfig.touchTolerancePct * 1.45;
  return line.r2 >= scannerConfig.minLineR2 || line.meanErrorPct <= scannerConfig.touchTolerancePct * 0.72;
}

function createEvidence(params: {
  upperSlopePctPerBar: number; lowerSlopePctPerBar: number; upper: TrendLine; lower: TrendLine;
  compressionPct: number; rangeCompressionPct: number; wickContainmentPct: number; bodyContainmentPct: number;
  violationPct: number; touchSpacingScore: number; alternationScore: number; apexProgressPct: number;
  apexBarsAway: number | null; breakoutDistancePct: number; invalidationDistancePct: number; currentWidthPct: number; formationBars: number;
}): PatternEvidence {
  const meanLineErrorPct = (params.upper.meanErrorPct + params.lower.meanErrorPct) / 2;
  const errorFit = clamp(100 - meanLineErrorPct / Math.max(0.05, scannerConfig.touchTolerancePct) * 72);
  const r2Fit = clamp((params.upper.r2 + params.lower.r2) / 2 * 100);
  const inlierFit = clamp((params.upper.inlierPct + params.lower.inlierPct) / 2);
  const fitScore = clamp(errorFit * 0.50 + r2Fit * 0.30 + inlierFit * 0.20);
  const totalTouches = Math.min(params.upper.touches, 5) + Math.min(params.lower.touches, 5);
  const touchCountScore = clamp((totalTouches - 4) / 6 * 100 + 55);
  const touchScore = clamp(touchCountScore * 0.66 + params.touchSpacingScore * 0.34);
  const apex = params.apexProgressPct;
  const convergenceScore = apex <= 100 ? clamp(100 - Math.abs(78 - apex) * 1.25) : clamp(80 - (apex - 100) * 2.8);
  const compressionScore = clamp(clamp(params.compressionPct * 1.28) * 0.72 + clamp(params.rangeCompressionPct * 1.35 + 22) * 0.28);
  const containmentScore = clamp(params.bodyContainmentPct * 0.52 + params.wickContainmentPct * 0.30 + clamp(100 - params.violationPct * 3.2) * 0.18);
  const structureScore = clamp(params.touchSpacingScore * 0.48 + params.alternationScore * 0.52);
  const proximityScore = clamp(100 - params.breakoutDistancePct * 32);
  return {
    upperSlopePctPerBar: round(params.upperSlopePctPerBar, 4), lowerSlopePctPerBar: round(params.lowerSlopePctPerBar, 4),
    upperR2: round(params.upper.r2, 3), lowerR2: round(params.lower.r2, 3), upperTouches: params.upper.touches, lowerTouches: params.lower.touches,
    upperInlierPct: round(params.upper.inlierPct, 1), lowerInlierPct: round(params.lower.inlierPct, 1),
    compressionPct: round(params.compressionPct, 1), rangeCompressionPct: round(params.rangeCompressionPct, 1),
    wickContainmentPct: round(params.wickContainmentPct, 1), bodyContainmentPct: round(params.bodyContainmentPct, 1), violationPct: round(params.violationPct, 1),
    touchSpacingScore: round(params.touchSpacingScore, 1), alternationScore: round(params.alternationScore, 1),
    apexProgressPct: round(params.apexProgressPct, 1), apexBarsAway: params.apexBarsAway,
    breakoutDistancePct: round(params.breakoutDistancePct, 3), invalidationDistancePct: round(params.invalidationDistancePct, 3),
    currentWidthPct: round(params.currentWidthPct, 3), formationBars: params.formationBars,
    fitScore: round(fitScore, 1), touchScore: round(touchScore, 1), convergenceScore: round(convergenceScore, 1), compressionScore: round(compressionScore, 1),
    containmentScore: round(containmentScore, 1), structureScore: round(structureScore, 1), proximityScore: round(proximityScore, 1),
  };
}

export function weightedScore(e: PatternEvidence): number {
  return round(clamp(e.fitScore * 0.20 + e.touchScore * 0.14 + e.convergenceScore * 0.14 + e.compressionScore * 0.16 + e.containmentScore * 0.16 + e.structureScore * 0.12 + e.proximityScore * 0.08), 1);
}

export function gradeScore(score: number): QualityGrade {
  if (score >= 90) return "A+";
  if (score >= 82) return "A";
  if (score >= 74) return "B";
  return "C";
}

function proofFor(pattern: PatternType, direction: Direction, breakout: number, invalidation: number): PatternProof {
  const structures: Record<PatternType, string> = {
    ASCENDING_TRIANGLE: "Rising support is compressing price into a near-flat resistance shelf.",
    DESCENDING_TRIANGLE: "Falling resistance is compressing price into a near-flat support shelf.",
    BULLISH_SYMMETRICAL_TRIANGLE: "Falling highs and rising lows are converging with bullish positional bias.",
    BEARISH_SYMMETRICAL_TRIANGLE: "Falling highs and rising lows are converging with bearish positional bias.",
    FALLING_WEDGE: "Both boundaries slope down while the lower boundary converges faster than resistance.",
    RISING_WEDGE: "Both boundaries slope up while the lower boundary converges into resistance faster.",
  };
  const bullish = direction === "BULLISH";
  return {
    structure: structures[pattern], confirmsAboveBelow: round(breakout, 4), invalidatesAboveBelow: round(invalidation, 4),
    confirmation: `${bullish ? "Close above" : "Close below"} ${round(breakout, 4)} with a strong candle finish confirms boundary escape.`,
    invalidation: `${bullish ? "Close below" : "Close above"} ${round(invalidation, 4)} breaks the opposite structural boundary.`,
  };
}

function fingerprint(symbol: string, pattern: PatternType, startTime: number, breakoutBoundary: number): string {
  return `${symbol}:${pattern}:${startTime}:${round(breakoutBoundary, 3)}`;
}

export function detectPattern(symbol: string, rawCandles: Candle[], options?: { lookbackBars?: number }): PatternResult | null {
  const candles = rawCandles
    .filter((bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.h >= bar.l && bar.c > 0)
    .sort((a, b) => a.t - b.t)
    .filter((bar, index, all) => index === 0 || bar.t !== all[index - 1]?.t)
    .slice(-Math.max(60, Math.min(600, options?.lookbackBars ?? scannerConfig.lookbackBars)));
  if (candles.length < 60) return null;
  const pivots = findPivots(candles, scannerConfig.pivotWindow);
  const upperPivots = recentPivots(pivots, "HIGH", scannerConfig.pivotPoolPerSide);
  const lowerPivots = recentPivots(pivots, "LOW", scannerConfig.pivotPoolPerSide);
  const geometry = buildGeometry(candles, upperPivots, lowerPivots);
  if (!geometry) return null;
  if (geometry.formationBars < scannerConfig.minFormationBars || geometry.formationBars > scannerConfig.maxFormationBars) return null;
  const endIndex = candles.length - 1;
  const price = geometry.referencePrice;
  const upperBoundary = lineValue(geometry.upper.slope, geometry.upper.intercept, endIndex);
  const lowerBoundary = lineValue(geometry.lower.slope, geometry.lower.intercept, endIndex);
  if (!(upperBoundary > lowerBoundary) || price <= 0) return null;
  const upperSlopePctPerBar = geometry.upper.slope / price * 100;
  const lowerSlopePctPerBar = geometry.lower.slope / price * 100;
  if (!effectiveLinePass(geometry.upper, upperSlopePctPerBar) || !effectiveLinePass(geometry.lower, lowerSlopePctPerBar)) return null;
  const shape = classifyShape({ upperSlopePctPerBar, lowerSlopePctPerBar, bullishBias: computeBias(candles, upperBoundary, lowerBoundary) });
  if (!shape) return null;
  if (geometry.apexIndex !== null && geometry.apexIndex <= endIndex - 3) return null;
  if (geometry.apexProgressPct < scannerConfig.minApexProgressPct || geometry.apexProgressPct > scannerConfig.maxApexProgressPct) return null;
  const breakoutBoundary = shape.direction === "BULLISH" ? upperBoundary : lowerBoundary;
  const invalidationBoundary = shape.direction === "BULLISH" ? lowerBoundary : upperBoundary;
  const breakoutDistancePct = Math.abs(price - breakoutBoundary) / price * 100;
  const invalidationDistancePct = Math.abs(price - invalidationBoundary) / price * 100;
  const evidence = createEvidence({
    upperSlopePctPerBar, lowerSlopePctPerBar, upper: geometry.upper, lower: geometry.lower,
    compressionPct: geometry.compressionPct, rangeCompressionPct: geometry.rangeCompressionPct,
    wickContainmentPct: geometry.wickContainmentPct, bodyContainmentPct: geometry.bodyContainmentPct, violationPct: geometry.violationPct,
    touchSpacingScore: geometry.touchSpacingScore, alternationScore: geometry.alternationScore, apexProgressPct: geometry.apexProgressPct, apexBarsAway: geometry.apexBarsAway,
    breakoutDistancePct, invalidationDistancePct, currentWidthPct: geometry.currentWidth / price * 100, formationBars: geometry.formationBars,
  });
  if (evidence.upperTouches < 2 || evidence.lowerTouches < 2) return null;
  if (evidence.compressionPct < scannerConfig.minCompressionPct || evidence.rangeCompressionPct < scannerConfig.minRangeCompressionPct) return null;
  if (evidence.wickContainmentPct < scannerConfig.minWickContainmentPct || evidence.bodyContainmentPct < scannerConfig.minBodyContainmentPct) return null;
  if (evidence.violationPct > scannerConfig.maxViolationPct || evidence.touchSpacingScore < scannerConfig.minTouchSpacingScore || evidence.alternationScore < scannerConfig.minAlternationScore) return null;
  const last = candles.at(-1);
  if (!last) return null;
  if (shape.direction === "BULLISH" && last.c < lowerBoundary * (1 - scannerConfig.confirmBufferPct / 100)) return null;
  if (shape.direction === "BEARISH" && last.c > upperBoundary * (1 + scannerConfig.confirmBufferPct / 100)) return null;
  const score = weightedScore(evidence);
  const grade = gradeScore(score);
  const state = classifyPatternState({ candles, direction: shape.direction, upper: geometry.upper, lower: geometry.lower, compressionPct: geometry.compressionPct, breakoutDistancePct });
  if (["BREAKING", "CONFIRMED"].includes(state) && breakoutDistancePct > 5) return null;
  const chartBars = candles.slice(-56);
  const chartStartIndex = candles.length - chartBars.length;
  const chartPivots = [...geometry.upperTouchPivots, ...geometry.lowerTouchPivots].filter((pivot) => pivot.index >= chartStartIndex).map((pivot) => ({ offset: pivot.index - chartStartIndex, price: pivot.price, kind: pivot.kind }));
  const startTime = candles[geometry.startIndex]?.t ?? candles[0]?.t ?? Date.now();
  return {
    symbol, pattern: shape.pattern, direction: shape.direction, state, score, grade,
    fingerprint: fingerprint(symbol, shape.pattern, startTime, breakoutBoundary),
    price: round(price, 4), upperBoundary: round(upperBoundary, 4), lowerBoundary: round(lowerBoundary, 4), breakoutBoundary: round(breakoutBoundary, 4), invalidationBoundary: round(invalidationBoundary, 4), detectedAt: last.t,
    evidence, proof: proofFor(shape.pattern, shape.direction, breakoutBoundary, invalidationBoundary),
    chart: {
      candles: chartBars.map(({ t, o, h, l, c }) => ({ t, o, h, l, c })),
      upper: { start: lineValue(geometry.upper.slope, geometry.upper.intercept, chartStartIndex), end: upperBoundary },
      lower: { start: lineValue(geometry.lower.slope, geometry.lower.intercept, chartStartIndex), end: lowerBoundary },
      pivots: chartPivots,
    },
  };
}
