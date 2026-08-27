export type Verdict = "PERMISSION" | "WAIT" | "NO_TRADE";
export type Regime = "ACCELERATING" | "GRACEFUL_CONTROL" | "STALLING" | "DISTRIBUTION" | "FLUSHING" | "UNKNOWN";

export type ChuckInput = {
  symbol: string;
  price: number;
  gainPct: number;
  volume: number;
  relativeVolume?: number;
  volumeAcceleration?: number;
  speedScore?: number;
  spreadPct?: number;
  buyerControl?: number;
  supportStrength?: number;
  riskDefined?: boolean;
  oneCandleConfirmed?: boolean;
  floatMillions?: number;
  catalystScore?: number;
  catalystNovelty?: "NEW" | "EXPANDED" | "REHASHED" | "NONE";
  dilutionRisk?: number;
  p905?: number;
  open930?: number;
  high935?: number;
  close940?: number;
};

export type ChuckResult = ChuckInput & {
  score: number;
  verdict: Verdict;
  regime: Regime;
  openRetention?: number;
  reclaimStrength?: number;
  postOpenExpansion?: number;
  expansionRetention?: number;
  reasons: string[];
  failures: string[];
};

const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));
const ratioPct = (a?: number, b?: number) => a && b ? (a / b) * 100 : undefined;

export function classifyRegime(i: ChuckInput): Regime {
  const speed = i.speedScore ?? 0;
  const accel = i.volumeAcceleration ?? 0;
  const buyers = i.buyerControl ?? 0;
  const support = i.supportStrength ?? 0;
  if (buyers >= 75 && support >= 70 && speed >= 65 && accel >= 1) return "ACCELERATING";
  if (buyers >= 65 && support >= 70 && speed >= 40) return "GRACEFUL_CONTROL";
  if (buyers < 40 && support < 40 && speed >= 60) return "FLUSHING";
  if (buyers < 45 && accel >= 1 && support < 55) return "DISTRIBUTION";
  if (speed < 35 && accel >= 0.8) return "STALLING";
  return "UNKNOWN";
}

export function analyzeWithChuck(i: ChuckInput): ChuckResult {
  const reasons: string[] = [];
  const failures: string[] = [];
  const speed = clamp(i.speedScore ?? 0);
  const buyers = clamp(i.buyerControl ?? 0);
  const support = clamp(i.supportStrength ?? 0);
  const catalyst = clamp(i.catalystScore ?? 0);
  const dilution = clamp(i.dilutionRisk ?? 0);
  const rvol = clamp(((i.relativeVolume ?? 0) / 10) * 100);
  const volAccel = clamp(((i.volumeAcceleration ?? 0) / 3) * 100);
  const spread = i.spreadPct == null ? 50 : clamp(100 - i.spreadPct * 18);

  let score = speed * 0.16 + volAccel * 0.14 + rvol * 0.08 + spread * 0.12 + buyers * 0.17 + support * 0.15 + catalyst * 0.08;
  score += i.riskDefined ? 6 : -10;
  score += i.oneCandleConfirmed ? 4 : 0;
  score -= dilution * 0.06;

  const openRetention = ratioPct(i.open930, i.p905);
  const reclaimStrength = ratioPct(i.high935, i.p905);
  const postOpenExpansion = ratioPct(i.high935, i.open930);
  const expansionRetention = i.open930 && i.high935 && i.close940
    ? ((i.close940 - i.open930) / Math.max(0.000001, i.high935 - i.open930)) * 100
    : undefined;

  if (openRetention != null) {
    if (openRetention >= 99) { score += 5; reasons.push("9:05 valuation held into the open"); }
    else if (openRetention < 94) { score -= 5; failures.push("meaningful 9:05 valuation loss before the bell"); }
  }
  if (reclaimStrength != null) {
    if (reclaimStrength >= 100) { score += 7; reasons.push("regular-hours buyers reclaimed the 9:05 price"); }
    else if (reclaimStrength < 97) { score -= 6; failures.push("failed to validate the 9:05 price"); }
  }
  if (expansionRetention != null && expansionRetention < 20) failures.push("post-open expansion mostly round-tripped");

  if (speed >= 60) reasons.push("speed is elevated"); else failures.push("speed is not proving urgency");
  if (buyers >= 65) reasons.push("buyers control the auction"); else failures.push("buyer control is weak");
  if (support >= 65) reasons.push("support is identifiable and holding"); else failures.push("support is not strong enough");
  if (i.spreadPct != null && i.spreadPct <= 1.5) reasons.push("spread is controlled");
  if (!i.riskDefined) failures.push("risk is not defined");

  score = clamp(score);
  const hardGate = i.riskDefined && buyers >= 55 && support >= 55;
  const verdict: Verdict = hardGate && score >= 78 ? "PERMISSION" : score >= 60 ? "WAIT" : "NO_TRADE";

  return {
    ...i,
    score: Math.round(score * 10) / 10,
    verdict,
    regime: classifyRegime(i),
    openRetention,
    reclaimStrength,
    postOpenExpansion,
    expansionRetention,
    reasons,
    failures,
  };
}

export function rankChuck(inputs: ChuckInput[]) {
  return inputs.map(analyzeWithChuck).sort((a, b) => b.score - a.score);
}
