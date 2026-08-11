import { scannerConfig } from "@/lib/config";
import { lineValue, linearRegression } from "@/lib/math/linearRegression";
import type { Candle, Pivot, TrendLine } from "@/lib/types";

export interface Geometry {
  upper: TrendLine;
  lower: TrendLine;
  upperPivots: Pivot[];
  lowerPivots: Pivot[];
  upperTouchPivots: Pivot[];
  lowerTouchPivots: Pivot[];
  startIndex: number;
  endIndex: number;
  formationBars: number;
  startWidth: number;
  currentWidth: number;
  compressionPct: number;
  rangeCompressionPct: number;
  wickContainmentPct: number;
  bodyContainmentPct: number;
  violationPct: number;
  touchSpacingScore: number;
  alternationScore: number;
  apexIndex: number | null;
  apexProgressPct: number;
  apexBarsAway: number | null;
  referencePrice: number;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted[middle];
  if (value === undefined) return 0;
  if (sorted.length % 2) return value;
  return ((sorted[middle - 1] ?? value) + value) / 2;
}

function regressionErrorPct(pivot: Pivot, slope: number, intercept: number): number {
  const expected = lineValue(slope, intercept, pivot.index);
  if (!Number.isFinite(expected) || Math.abs(expected) < Number.EPSILON) return Infinity;
  return Math.abs(pivot.price - expected) / Math.abs(expected) * 100;
}

function fitTrendLine(pivots: Pivot[], tolerancePct: number): { line: TrendLine; inliers: Pivot[]; touches: Pivot[] } {
  const initial = linearRegression(pivots.map((pivot) => ({ x: pivot.index, y: pivot.price })));
  const initialErrors = pivots.map((pivot) => regressionErrorPct(pivot, initial.slope, initial.intercept));
  const medianError = median(initialErrors.filter(Number.isFinite));
  const trimCutoff = Math.max(tolerancePct * 2.6, medianError * 2.75, 0.08);
  const trimmed = pivots.filter((pivot) => regressionErrorPct(pivot, initial.slope, initial.intercept) <= trimCutoff);
  const inliers = trimmed.length >= scannerConfig.minPivotsPerSide ? trimmed : pivots;
  const regression = linearRegression(inliers.map((pivot) => ({ x: pivot.index, y: pivot.price })));

  const allErrors = pivots.map((pivot) => regressionErrorPct(pivot, regression.slope, regression.intercept));
  const touches = pivots.filter((pivot) => regressionErrorPct(pivot, regression.slope, regression.intercept) <= tolerancePct);
  const finiteErrors = allErrors.filter(Number.isFinite);

  return {
    line: {
      ...regression,
      meanErrorPct: finiteErrors.length ? finiteErrors.reduce((sum, value) => sum + value, 0) / finiteErrors.length : Infinity,
      points: inliers.length,
      touches: touches.length,
      inlierPct: pivots.length ? inliers.length / pivots.length * 100 : 0,
    },
    inliers,
    touches,
  };
}

export function touchSpacingScore(pivots: Pivot[], startIndex: number, endIndex: number): number {
  if (pivots.length < 2 || endIndex <= startIndex) return 0;
  const sorted = [...pivots].sort((a, b) => a.index - b.index);
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) return 0;
  const formationSpan = Math.max(1, endIndex - startIndex);
  const coverage = clamp((last.index - first.index) / formationSpan * 100);
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    const previous = sorted[i - 1];
    if (current && previous) gaps.push(current.index - previous.index);
  }
  const meanGap = gaps.length ? gaps.reduce((sum, value) => sum + value, 0) / gaps.length : 0;
  const variance = meanGap > 0 ? gaps.reduce((sum, value) => sum + (value - meanGap) ** 2, 0) / Math.max(1, gaps.length) : 0;
  const coefficientOfVariation = meanGap > 0 ? Math.sqrt(variance) / meanGap : 1;
  const distribution = clamp(100 - coefficientOfVariation * 55);
  const recency = clamp(100 - Math.max(0, endIndex - last.index - 8) * 4);
  return clamp(coverage * 0.55 + distribution * 0.25 + recency * 0.20);
}

export function alternationScore(upper: Pivot[], lower: Pivot[]): number {
  const sequence = [...upper, ...lower].sort((a, b) => a.index - b.index);
  if (sequence.length < 4) return 0;
  let transitions = 0;
  let meaningful = 0;
  let previous = sequence[0];
  for (let i = 1; i < sequence.length; i += 1) {
    const current = sequence[i];
    if (!current || !previous) continue;
    if (current.index === previous.index) continue;
    meaningful += 1;
    if (current.kind !== previous.kind) transitions += 1;
    previous = current;
  }
  return meaningful ? clamp(transitions / meaningful * 100) : 0;
}

export function rangeCompressionPct(candles: Candle[], startIndex: number, endIndex: number): number {
  const slice = candles.slice(startIndex, endIndex + 1);
  if (slice.length < 12) return 0;
  const segment = Math.max(4, Math.floor(slice.length / 3));
  const normalizedRange = (bar: Candle) => bar.c > 0 ? (bar.h - bar.l) / bar.c * 100 : 0;
  const early = median(slice.slice(0, segment).map(normalizedRange));
  const late = median(slice.slice(-segment).map(normalizedRange));
  if (!(early > 0)) return 0;
  return clamp((1 - late / early) * 100);
}

function containmentMetrics(candles: Candle[], upper: TrendLine, lower: TrendLine, startIndex: number, endIndex: number) {
  let wickContained = 0;
  let bodyContained = 0;
  let violated = 0;
  let checked = 0;
  const formationEnd = Math.max(startIndex, endIndex - 2);
  for (let i = startIndex; i <= formationEnd; i += 1) {
    const candle = candles[i];
    if (!candle) continue;
    const upperBoundary = lineValue(upper.slope, upper.intercept, i);
    const lowerBoundary = lineValue(lower.slope, lower.intercept, i);
    if (!(upperBoundary > lowerBoundary)) continue;
    const tolerance = Math.max(candle.c * scannerConfig.touchTolerancePct / 100, 0.0001);
    const bodyHigh = Math.max(candle.o, candle.c);
    const bodyLow = Math.min(candle.o, candle.c);
    const wickInside = candle.h <= upperBoundary + tolerance && candle.l >= lowerBoundary - tolerance;
    const bodyInside = bodyHigh <= upperBoundary + tolerance && bodyLow >= lowerBoundary - tolerance;
    const closeViolation = candle.c > upperBoundary + tolerance * 1.35 || candle.c < lowerBoundary - tolerance * 1.35;
    if (wickInside) wickContained += 1;
    if (bodyInside) bodyContained += 1;
    if (closeViolation) violated += 1;
    checked += 1;
  }
  return {
    wickContainmentPct: checked ? wickContained / checked * 100 : 0,
    bodyContainmentPct: checked ? bodyContained / checked * 100 : 0,
    violationPct: checked ? violated / checked * 100 : 100,
  };
}

export function buildGeometry(candles: Candle[], upperPivots: Pivot[], lowerPivots: Pivot[]): Geometry | null {
  if (upperPivots.length < scannerConfig.minPivotsPerSide || lowerPivots.length < scannerConfig.minPivotsPerSide) return null;
  const upperFit = fitTrendLine(upperPivots, scannerConfig.touchTolerancePct);
  const lowerFit = fitTrendLine(lowerPivots, scannerConfig.touchTolerancePct);
  const upper = upperFit.line;
  const lower = lowerFit.line;
  const oldestUpper = upperFit.inliers[0] ?? upperPivots[0];
  const oldestLower = lowerFit.inliers[0] ?? lowerPivots[0];
  if (!oldestUpper || !oldestLower) return null;
  const startIndex = Math.max(0, Math.min(oldestUpper.index, oldestLower.index));
  const endIndex = candles.length - 1;
  const formationBars = endIndex - startIndex + 1;
  const startUpper = lineValue(upper.slope, upper.intercept, startIndex);
  const startLower = lineValue(lower.slope, lower.intercept, startIndex);
  const endUpper = lineValue(upper.slope, upper.intercept, endIndex);
  const endLower = lineValue(lower.slope, lower.intercept, endIndex);
  const startWidth = startUpper - startLower;
  const currentWidth = endUpper - endLower;
  if (!(startWidth > 0) || !(currentWidth > 0) || formationBars < 2) return null;
  const compressionPct = clamp((1 - currentWidth / startWidth) * 100);
  const denominator = upper.slope - lower.slope;
  const apexIndex = Math.abs(denominator) < 1e-12 ? null : (lower.intercept - upper.intercept) / denominator;
  let apexProgressPct = 0;
  let apexBarsAway: number | null = null;
  if (apexIndex !== null && apexIndex > startIndex) {
    apexProgressPct = clamp((endIndex - startIndex) / (apexIndex - startIndex) * 100, 0, 130);
    apexBarsAway = Math.round(apexIndex - endIndex);
  }
  const containment = containmentMetrics(candles, upper, lower, startIndex, endIndex);
  const upperSpacing = touchSpacingScore(upperFit.touches, startIndex, endIndex);
  const lowerSpacing = touchSpacingScore(lowerFit.touches, startIndex, endIndex);
  const last = candles[endIndex];
  if (!last) return null;
  return {
    upper, lower,
    upperPivots: upperFit.inliers,
    lowerPivots: lowerFit.inliers,
    upperTouchPivots: upperFit.touches,
    lowerTouchPivots: lowerFit.touches,
    startIndex, endIndex, formationBars, startWidth, currentWidth, compressionPct,
    rangeCompressionPct: rangeCompressionPct(candles, startIndex, Math.max(startIndex, endIndex - 2)),
    wickContainmentPct: containment.wickContainmentPct,
    bodyContainmentPct: containment.bodyContainmentPct,
    violationPct: containment.violationPct,
    touchSpacingScore: (upperSpacing + lowerSpacing) / 2,
    alternationScore: alternationScore(upperFit.touches, lowerFit.touches),
    apexIndex, apexProgressPct, apexBarsAway,
    referencePrice: last.c,
  };
}
