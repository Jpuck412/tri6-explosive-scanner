import type { Candle, Pivot } from "@/lib/types";

export function findPivots(candles: Candle[], window: number): Pivot[] {
  const pivots: Pivot[] = [];
  if (candles.length < window * 2 + 3) return pivots;

  for (let i = window; i < candles.length - window; i += 1) {
    const current = candles[i];
    if (!current) continue;

    let isHigh = true;
    let isLow = true;

    for (let j = i - window; j <= i + window; j += 1) {
      if (j === i) continue;
      const other = candles[j];
      if (!other) continue;
      if (other.h >= current.h) isHigh = false;
      if (other.l <= current.l) isLow = false;
      if (!isHigh && !isLow) break;
    }

    if (isHigh) pivots.push({ index: i, price: current.h, time: current.t, kind: "HIGH" });
    if (isLow) pivots.push({ index: i, price: current.l, time: current.t, kind: "LOW" });
  }

  return pivots.sort((a, b) => a.index - b.index);
}

export function recentPivots(pivots: Pivot[], kind: Pivot["kind"], limit = 7): Pivot[] {
  return pivots.filter((pivot) => pivot.kind === kind).slice(-limit);
}
