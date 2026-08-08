import { scannerConfig } from "@/lib/config";
import { lineValue, linearRegression } from "@/lib/math/linearRegression";
import type { Candle, Pivot, TrendLine } from "@/lib/types";

export interface Geometry {
  upper: TrendLine;
  lower: TrendLine;
  upperPivots: Pivot[];
  lowerPivots: Pivot[];
  startIndex: number;
  endIndex: number;
  startWidth: number;
  currentWidth: number;
  compressionPct: number;
  containmentPct: number;
  apexIndex: number | null;
  apexProgressPct: number;
  referencePrice: number;
}

function fitTrendLine(pivots: Pivot[], tolerancePct: number): TrendLine {
  const regression = linearRegression(pivots.map((pivot) => ({ x: pivot.index, y: pivot.price })));
  let touches = 0;
  let errorTotalPct = 0;

  for (const pivot of pivots) {
    const expected = lineValue(regression.slope, regression.intercept, pivot.index);
    const distancePct = expected === 0 ? Infinity : Math.abs(pivot.price - expected) / Math.abs(expected) * 100;
    if (distancePct <= tolerancePct) touches += 1;
    if (Number.isFinite(distancePct)) errorTotalPct += distancePct;
  }

  return {
    ...regression,
    meanErrorPct: pivots.length ? errorTotalPct / pivots.length : Infinity,
    points: pivots.length,
    touches,
  };
}

export function buildGeometry(candles: Candle[], upperPivots: Pivot[], lowerPivots: Pivot[]): Geometry | null {
  if (upperPivots.length < scannerConfig.minPivotsPerSide || lowerPivots.length < scannerConfig.minPivotsPerSide) {
    return null;
  }

  const upper = fitTrendLine(upperPivots, scannerConfig.touchTolerancePct);
  const lower = fitTrendLine(lowerPivots, scannerConfig.touchTolerancePct);
  const startIndex = Math.max(0, Math.min(upperPivots[0]?.index ?? 0, lowerPivots[0]?.index ?? 0));
  const endIndex = candles.length - 1;
  const startUpper = lineValue(upper.slope, upper.intercept, startIndex);
  const startLower = lineValue(lower.slope, lower.intercept, startIndex);
  const endUpper = lineValue(upper.slope, upper.intercept, endIndex);
  const endLower = lineValue(lower.slope, lower.intercept, endIndex);
  const startWidth = startUpper - startLower;
  const currentWidth = endUpper - endLower;

  if (!(startWidth > 0) || !(currentWidth > 0)) return null;

  const compressionPct = Math.max(0, Math.min(100, (1 - currentWidth / startWidth) * 100));
  const denominator = upper.slope - lower.slope;
  const apexIndex = Math.abs(denominator) < 1e-12
    ? null
    : (lower.intercept - upper.intercept) / denominator;

  let apexProgressPct = 0;
  if (apexIndex !== null && apexIndex > startIndex) {
    apexProgressPct = Math.max(0, Math.min(130, (endIndex - startIndex) / (apexIndex - startIndex) * 100));
  }

  let contained = 0;
  let checked = 0;
  for (let i = startIndex; i <= endIndex; i += 1) {
    const candle = candles[i];
    if (!candle) continue;
    const highBoundary = lineValue(upper.slope, upper.intercept, i);
    const lowBoundary = lineValue(lower.slope, lower.intercept, i);
    const tolerance = Math.max(candle.c * 0.0025, 0.0001);
    if (candle.h <= highBoundary + tolerance && candle.l >= lowBoundary - tolerance) contained += 1;
    checked += 1;
  }

  const last = candles[endIndex];
  if (!last) return null;

  return {
    upper,
    lower,
    upperPivots,
    lowerPivots,
    startIndex,
    endIndex,
    startWidth,
    currentWidth,
    compressionPct,
    containmentPct: checked ? contained / checked * 100 : 0,
    apexIndex,
    apexProgressPct,
    referencePrice: last.c,
  };
}
