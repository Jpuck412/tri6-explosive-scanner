import type { Candle, Pivot } from "@/lib/types";

function stronger(a: Pivot, b: Pivot): Pivot {
  if (a.kind !== b.kind) return b;
  if (a.kind === "HIGH") return b.price >= a.price ? b : a;
  return b.price <= a.price ? b : a;
}

function compressClusters(pivots: Pivot[], minBarsApart: number): Pivot[] {
  const output: Pivot[] = [];
  for (const pivot of pivots) {
    const last = output.at(-1);
    if (last && last.kind === pivot.kind && pivot.index - last.index <= minBarsApart) {
      output[output.length - 1] = stronger(last, pivot);
    } else {
      output.push(pivot);
    }
  }
  return output;
}

export function findPivots(candles: Candle[], window: number): Pivot[] {
  const pivots: Pivot[] = [];
  if (candles.length < window * 2 + 3) return pivots;

  for (let i = window; i < candles.length - window; i += 1) {
    const current = candles[i];
    if (!current) continue;

    let highDominates = true;
    let lowDominates = true;
    let highHasStrictNeighbor = false;
    let lowHasStrictNeighbor = false;

    for (let j = i - window; j <= i + window; j += 1) {
      if (j === i) continue;
      const other = candles[j];
      if (!other) continue;
      if (other.h > current.h) highDominates = false;
      if (other.h < current.h) highHasStrictNeighbor = true;
      if (other.l < current.l) lowDominates = false;
      if (other.l > current.l) lowHasStrictNeighbor = true;
      if (!highDominates && !lowDominates) break;
    }

    if (highDominates && highHasStrictNeighbor) pivots.push({ index: i, price: current.h, time: current.t, kind: "HIGH" });
    if (lowDominates && lowHasStrictNeighbor) pivots.push({ index: i, price: current.l, time: current.t, kind: "LOW" });
  }

  const highs = compressClusters(pivots.filter((pivot) => pivot.kind === "HIGH"), Math.max(1, window));
  const lows = compressClusters(pivots.filter((pivot) => pivot.kind === "LOW"), Math.max(1, window));
  return [...highs, ...lows].sort((a, b) => a.index - b.index || (a.kind === "HIGH" ? -1 : 1));
}

export function recentPivots(pivots: Pivot[], kind: Pivot["kind"], limit = 9): Pivot[] {
  return pivots.filter((pivot) => pivot.kind === kind).slice(-limit);
}
