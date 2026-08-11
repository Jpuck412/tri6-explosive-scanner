import { scannerConfig } from "@/lib/config";
import { lineValue } from "@/lib/math/linearRegression";
import type { Candle, Direction, PatternState, TrendLine } from "@/lib/types";

function candleCloseLocation(candle: Candle): number {
  const range = candle.h - candle.l;
  if (!(range > 0)) return 0.5;
  return Math.max(0, Math.min(1, (candle.c - candle.l) / range));
}

export function classifyPatternState(params: {
  candles: Candle[];
  direction: Direction;
  upper: TrendLine;
  lower: TrendLine;
  compressionPct: number;
  breakoutDistancePct: number;
}): PatternState {
  const { candles, direction, upper, lower, compressionPct, breakoutDistancePct } = params;
  const lastIndex = candles.length - 1;
  const last = candles[lastIndex];
  const previous = candles[lastIndex - 1];
  if (!last || !previous) return "FORMING";
  const buffer = scannerConfig.confirmBufferPct / 100;
  const strong = scannerConfig.strongCloseThresholdPct / 100;
  const lastUpper = lineValue(upper.slope, upper.intercept, lastIndex);
  const lastLower = lineValue(lower.slope, lower.intercept, lastIndex);
  const closeLocation = candleCloseLocation(last);
  if (direction === "BULLISH") {
    if (last.c > lastUpper * (1 + buffer) && closeLocation >= strong) return "CONFIRMED";
    if (last.c > lastUpper || last.h > lastUpper * (1 + buffer * 0.35)) return "BREAKING";
  } else {
    if (last.c < lastLower * (1 - buffer) && closeLocation <= 1 - strong) return "CONFIRMED";
    if (last.c < lastLower || last.l < lastLower * (1 - buffer * 0.35)) return "BREAKING";
  }
  if (breakoutDistancePct <= scannerConfig.readyDistancePct && compressionPct >= Math.max(35, scannerConfig.minCompressionPct)) return "READY";
  if (compressionPct >= Math.max(35, scannerConfig.minCompressionPct)) return "COMPRESSED";
  return "FORMING";
}
