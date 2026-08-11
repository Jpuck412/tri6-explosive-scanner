import { describe, expect, it } from "vitest";
import { classifyPatternState } from "@/lib/engine/state";
import type { Candle, TrendLine } from "@/lib/types";

const line = (slope: number, intercept: number): TrendLine => ({ slope, intercept, r2: 0.95, meanErrorPct: 0.1, points: 4, touches: 4, inlierPct: 100 });
const candle = (index: number, o: number, h: number, l: number, c: number): Candle => ({ t: index * 60_000, o, h, l, c, v: 1000 });

describe("TRI6 breakout lifecycle", () => {
  it("requires a strong close for confirmed bullish escape", () => {
    const candles = [candle(0, 9.7, 9.95, 9.5, 9.8), candle(1, 9.85, 10.3, 9.8, 10.25)];
    expect(classifyPatternState({ candles, direction: "BULLISH", upper: line(0, 10), lower: line(0.1, 8), compressionPct: 65, breakoutDistancePct: 0.2 })).toBe("CONFIRMED");
  });
  it("calls a wick probe breaking instead of confirmed", () => {
    const candles = [candle(0, 9.7, 9.95, 9.5, 9.8), candle(1, 9.85, 10.15, 9.7, 9.92)];
    expect(classifyPatternState({ candles, direction: "BULLISH", upper: line(0, 10), lower: line(0.1, 8), compressionPct: 65, breakoutDistancePct: 0.8 })).toBe("BREAKING");
  });
});
