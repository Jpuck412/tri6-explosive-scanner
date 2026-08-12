import { describe, expect, it } from "vitest";
import { evaluateFutureOutcome, summarizeReplay } from "@/lib/engine/replay";
import type { Candle, ReplaySignal } from "@/lib/types";

function candle(index: number, high: number, low: number, close: number): Candle {
  return { t: index * 60_000, o: close, h: high, l: low, c: close, v: 1_000 };
}

describe("TRI6 walk-forward outcome evaluation", () => {
  it("marks bullish proof before invalidation", () => {
    const result = evaluateFutureOutcome({
      direction: "BULLISH",
      entryPrice: 10,
      breakoutBoundary: 10.5,
      invalidationBoundary: 9.5,
      future: [candle(1, 10.6, 9.8, 10.4), candle(2, 10.8, 10.1, 10.7)],
    });
    expect(result.outcome).toBe("PROOF_FIRST");
    expect(result.proofBars).toBe(1);
    expect(result.invalidationBars).toBeNull();
    expect(result.mfePct).toBe(8);
    expect(result.maePct).toBe(2);
    expect(result.endReturnPct).toBe(7);
  });

  it("marks bullish invalidation before proof", () => {
    const result = evaluateFutureOutcome({
      direction: "BULLISH",
      entryPrice: 10,
      breakoutBoundary: 10.5,
      invalidationBoundary: 9.5,
      future: [candle(1, 10.2, 9.4, 9.6), candle(2, 10.7, 9.6, 10.6)],
    });
    expect(result.outcome).toBe("INVALIDATION_FIRST");
    expect(result.invalidationBars).toBe(1);
  });

  it("marks a same-bar boundary sweep as ambiguous", () => {
    const result = evaluateFutureOutcome({
      direction: "BULLISH",
      entryPrice: 10,
      breakoutBoundary: 10.5,
      invalidationBoundary: 9.5,
      future: [candle(1, 10.6, 9.4, 10)],
    });
    expect(result.outcome).toBe("AMBIGUOUS");
    expect(result.proofBars).toBe(1);
    expect(result.invalidationBars).toBe(1);
  });

  it("evaluates bearish excursions in the correct direction", () => {
    const result = evaluateFutureOutcome({
      direction: "BEARISH",
      entryPrice: 10,
      breakoutBoundary: 9.5,
      invalidationBoundary: 10.5,
      future: [candle(1, 10.2, 9.4, 9.6)],
    });
    expect(result.outcome).toBe("PROOF_FIRST");
    expect(result.mfePct).toBe(6);
    expect(result.maePct).toBe(2);
    expect(result.endReturnPct).toBe(4);
  });

  it("summarizes proof rate and directional excursion statistics", () => {
    const base: Omit<ReplaySignal, "outcome" | "mfePct" | "maePct" | "endReturnPct"> = {
      detectedAt: 1,
      pattern: "ASCENDING_TRIANGLE",
      direction: "BULLISH",
      state: "READY",
      score: 84,
      grade: "A",
      entryPrice: 10,
      breakoutBoundary: 10.5,
      invalidationBoundary: 9.5,
      proofBars: 1,
      invalidationBars: null,
    };
    const signals: ReplaySignal[] = [
      { ...base, outcome: "PROOF_FIRST", mfePct: 8, maePct: 2, endReturnPct: 5 },
      { ...base, outcome: "INVALIDATION_FIRST", proofBars: null, invalidationBars: 2, mfePct: 2, maePct: 5, endReturnPct: -3 },
    ];
    const summary = summarizeReplay(signals);
    expect(summary.signals).toBe(2);
    expect(summary.proofFirstRatePct).toBe(50);
    expect(summary.avgMfePct).toBe(5);
    expect(summary.avgMaePct).toBe(3.5);
    expect(summary.avgEndReturnPct).toBe(1);
  });
});
