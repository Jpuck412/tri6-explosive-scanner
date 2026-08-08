import type { PatternResult } from "@/lib/types";

export function StructureChart({ result }: { result: PatternResult }) {
  const bars = result.chart.candles;
  if (bars.length < 2) return null;

  const values = bars.flatMap((bar) => [bar.h, bar.l]);
  values.push(result.chart.upper.start, result.chart.upper.end, result.chart.lower.start, result.chart.lower.end);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.005, 0.0001);
  const width = 420;
  const height = 130;
  const pad = 8;
  const x = (index: number) => pad + index / Math.max(1, bars.length - 1) * (width - pad * 2);
  const y = (price: number) => pad + (max - price) / range * (height - pad * 2);

  const closePath = bars.map((bar, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(bar.c).toFixed(1)}`).join(" ");
  const bullish = result.direction === "BULLISH";

  return (
    <svg className="structure-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${result.symbol} ${result.pattern} structure`}>
      <path d={closePath} fill="none" stroke={bullish ? "#45f0b0" : "#ff647c"} strokeWidth="2.1" vectorEffect="non-scaling-stroke" />
      <line x1={x(0)} y1={y(result.chart.upper.start)} x2={x(bars.length - 1)} y2={y(result.chart.upper.end)} stroke="#7ab8ff" strokeWidth="1.4" strokeDasharray="5 4" />
      <line x1={x(0)} y1={y(result.chart.lower.start)} x2={x(bars.length - 1)} y2={y(result.chart.lower.end)} stroke="#a88cff" strokeWidth="1.4" strokeDasharray="5 4" />
    </svg>
  );
}
