import { describe, expect, it } from "vitest";
import { alternationScore, rangeCompressionPct, touchSpacingScore } from "@/lib/engine/geometry";
import type { Candle, Pivot } from "@/lib/types";

function pivot(index: number, kind: Pivot["kind"], price = 10): Pivot { return { index, kind, price, time: index * 60_000 }; }

describe("TRI6 elite geometry quality", () => {
  it("rewards touches distributed across the formation", () => {
    const distributed = [pivot(5, "HIGH"), pivot(18, "HIGH"), pivot(34, "HIGH"), pivot(50, "HIGH")];
    const clustered = [pivot(35, "HIGH"), pivot(38, "HIGH"), pivot(41, "HIGH"), pivot(44, "HIGH")];
    expect(touchSpacingScore(distributed, 0, 55)).toBeGreaterThan(touchSpacingScore(clustered, 0, 55));
  });
  it("scores clean upper/lower oscillation highly", () => {
    const upper = [pivot(5, "HIGH"), pivot(20, "HIGH"), pivot(35, "HIGH")];
    const lower = [pivot(12, "LOW"), pivot(27, "LOW"), pivot(43, "LOW")];
    expect(alternationScore(upper, lower)).toBeGreaterThanOrEqual(95);
  });
  it("detects shrinking candle range inside a compression", () => {
    const candles: Candle[] = Array.from({ length: 30 }, (_, index) => {
      const center = 10; const range = 1.2 - index * 0.025;
      return { t: index * 60_000, o: center - range * 0.08, h: center + range / 2, l: center - range / 2, c: center + range * 0.08, v: 1000 };
    });
    expect(rangeCompressionPct(candles, 0, 29)).toBeGreaterThan(25);
  });
});
