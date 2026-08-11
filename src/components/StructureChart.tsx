import type { PatternResult } from "@/lib/types";

export function StructureChart({ result }: { result: PatternResult }) {
  const bars = result.chart.candles;
  if (bars.length < 2) return null;
  const values = bars.flatMap((bar) => [bar.h, bar.l]);
  values.push(result.chart.upper.start, result.chart.upper.end, result.chart.lower.start, result.chart.lower.end);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, max * 0.005, 0.0001);
  const width = 440;
  const height = 150;
  const pad = 10;
  const x = (index: number) => pad + index / Math.max(1, bars.length - 1) * (width - pad * 2);
  const y = (price: number) => pad + (max - price) / range * (height - pad * 2);
  const candleWidth = Math.max(2.2, Math.min(5.2, (width - pad * 2) / bars.length * 0.62));
  const bullishBias = result.direction === "BULLISH";
  const gradientId = `zone-${result.fingerprint.replace(/[^A-Za-z0-9]/g, "")}`;
  return (
    <svg className="structure-chart elite-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${result.symbol} ${result.pattern} price structure`}>
      <defs><linearGradient id={gradientId} x1="0" x2="1"><stop offset="0%" stopColor={bullishBias ? "#35f0ae" : "#ff5e78"} stopOpacity="0.02" /><stop offset="100%" stopColor={bullishBias ? "#35f0ae" : "#ff5e78"} stopOpacity="0.12" /></linearGradient></defs>
      <polygon points={`${x(0)},${y(result.chart.upper.start)} ${x(bars.length - 1)},${y(result.chart.upper.end)} ${x(bars.length - 1)},${y(result.chart.lower.end)} ${x(0)},${y(result.chart.lower.start)}`} fill={`url(#${gradientId})`} />
      {bars.map((bar, index) => {
        const up = bar.c >= bar.o;
        const color = up ? "#43e7ad" : "#ff667d";
        const bodyTop = y(Math.max(bar.o, bar.c));
        const bodyBottom = y(Math.min(bar.o, bar.c));
        return <g key={`${bar.t}-${index}`} opacity={index >= bars.length - 2 ? 1 : 0.76}><line x1={x(index)} y1={y(bar.h)} x2={x(index)} y2={y(bar.l)} stroke={color} strokeWidth="0.8" /><rect x={x(index) - candleWidth / 2} y={bodyTop} width={candleWidth} height={Math.max(1.2, bodyBottom - bodyTop)} rx="0.6" fill={up ? color : "transparent"} stroke={color} strokeWidth="0.8" /></g>;
      })}
      <line x1={x(0)} y1={y(result.chart.upper.start)} x2={x(bars.length - 1)} y2={y(result.chart.upper.end)} stroke="#6eb5ff" strokeWidth="1.7" strokeDasharray="5 4" />
      <line x1={x(0)} y1={y(result.chart.lower.start)} x2={x(bars.length - 1)} y2={y(result.chart.lower.end)} stroke="#a987ff" strokeWidth="1.7" strokeDasharray="5 4" />
      {result.chart.pivots.map((pivot, index) => <circle key={`${pivot.kind}-${pivot.offset}-${index}`} cx={x(pivot.offset)} cy={y(pivot.price)} r="2.7" fill={pivot.kind === "HIGH" ? "#6eb5ff" : "#a987ff"} stroke="#07101c" strokeWidth="1" />)}
      <circle cx={x(bars.length - 1)} cy={y(bars.at(-1)?.c ?? result.price)} r="3.4" fill={bullishBias ? "#43e7ad" : "#ff667d"} stroke="#ffffff" strokeWidth="0.8" />
    </svg>
  );
}
