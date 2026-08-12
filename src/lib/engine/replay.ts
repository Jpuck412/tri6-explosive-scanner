import type {
  Candle,
  PatternState,
  QualityGrade,
  ReplayOutcome,
  ReplayPatternStats,
  ReplaySignal,
} from "@/lib/types";
import { detectPattern } from "./scan";

const round = (value: number, decimals = 3) => Number(value.toFixed(decimals));

const gradeRank: Record<QualityGrade, number> = { "A+": 4, A: 3, B: 2, C: 1 };

export interface ReplayOptions {
  warmupBars: number;
  evaluationBars: number;
  stepBars: number;
  minScore: number;
  minGrade: QualityGrade;
  states: PatternState[];
  maxSignals: number;
}

export interface FutureEvaluation {
  outcome: ReplayOutcome;
  proofBars: number | null;
  invalidationBars: number | null;
  mfePct: number;
  maePct: number;
  endReturnPct: number;
}

function directionalReturn(direction: "BULLISH" | "BEARISH", entry: number, exit: number): number {
  if (!(entry > 0)) return 0;
  const raw = (exit - entry) / entry * 100;
  return direction === "BULLISH" ? raw : -raw;
}

export function evaluateFutureOutcome(params: {
  direction: "BULLISH" | "BEARISH";
  entryPrice: number;
  breakoutBoundary: number;
  invalidationBoundary: number;
  future: Candle[];
}): FutureEvaluation {
  const { direction, entryPrice, breakoutBoundary, invalidationBoundary, future } = params;
  let proofBars: number | null = null;
  let invalidationBars: number | null = null;

  for (let index = 0; index < future.length; index += 1) {
    const bar = future[index];
    if (!bar) continue;
    const proofHit = direction === "BULLISH" ? bar.h >= breakoutBoundary : bar.l <= breakoutBoundary;
    const invalidationHit = direction === "BULLISH" ? bar.l <= invalidationBoundary : bar.h >= invalidationBoundary;
    if (proofBars === null && proofHit) proofBars = index + 1;
    if (invalidationBars === null && invalidationHit) invalidationBars = index + 1;
    if (proofBars !== null || invalidationBars !== null) {
      if (proofBars !== null && invalidationBars !== null) break;
      const firstKnown = proofBars ?? invalidationBars;
      if (firstKnown !== null && index + 1 > firstKnown) break;
    }
  }

  let outcome: ReplayOutcome = "NEITHER";
  if (proofBars !== null && invalidationBars !== null) {
    outcome = proofBars === invalidationBars
      ? "AMBIGUOUS"
      : proofBars < invalidationBars
        ? "PROOF_FIRST"
        : "INVALIDATION_FIRST";
  } else if (proofBars !== null) {
    outcome = "PROOF_FIRST";
  } else if (invalidationBars !== null) {
    outcome = "INVALIDATION_FIRST";
  }

  let best = entryPrice;
  let worst = entryPrice;
  for (const bar of future) {
    if (direction === "BULLISH") {
      best = Math.max(best, bar.h);
      worst = Math.min(worst, bar.l);
    } else {
      best = Math.min(best, bar.l);
      worst = Math.max(worst, bar.h);
    }
  }

  const mfePct = direction === "BULLISH"
    ? directionalReturn(direction, entryPrice, best)
    : directionalReturn(direction, entryPrice, best);
  const maePct = direction === "BULLISH"
    ? Math.max(0, (entryPrice - worst) / entryPrice * 100)
    : Math.max(0, (worst - entryPrice) / entryPrice * 100);
  const end = future.at(-1)?.c ?? entryPrice;

  return {
    outcome,
    proofBars,
    invalidationBars,
    mfePct: round(Math.max(0, mfePct)),
    maePct: round(maePct),
    endReturnPct: round(directionalReturn(direction, entryPrice, end)),
  };
}

function formationKey(fingerprint: string): string {
  const pieces = fingerprint.split(":");
  return pieces.slice(0, Math.min(3, pieces.length)).join(":");
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeReplay(signals: ReplaySignal[]): ReplayPatternStats {
  const proofFirst = signals.filter((signal) => signal.outcome === "PROOF_FIRST").length;
  const invalidationFirst = signals.filter((signal) => signal.outcome === "INVALIDATION_FIRST").length;
  const ambiguous = signals.filter((signal) => signal.outcome === "AMBIGUOUS").length;
  const neither = signals.filter((signal) => signal.outcome === "NEITHER").length;
  return {
    signals: signals.length,
    proofFirst,
    invalidationFirst,
    ambiguous,
    neither,
    proofFirstRatePct: signals.length ? round(proofFirst / signals.length * 100, 1) : 0,
    avgMfePct: round(average(signals.map((signal) => signal.mfePct))),
    avgMaePct: round(average(signals.map((signal) => signal.maePct))),
    avgEndReturnPct: round(average(signals.map((signal) => signal.endReturnPct))),
  };
}

export function replayCandles(symbol: string, rawCandles: Candle[], options: ReplayOptions): ReplaySignal[] {
  const candles = rawCandles
    .filter((bar) => [bar.t, bar.o, bar.h, bar.l, bar.c, bar.v].every(Number.isFinite) && bar.h >= bar.l && bar.c > 0)
    .sort((a, b) => a.t - b.t)
    .filter((bar, index, all) => index === 0 || bar.t !== all[index - 1]?.t);

  const warmupBars = Math.max(60, Math.min(300, Math.floor(options.warmupBars)));
  const evaluationBars = Math.max(1, Math.min(60, Math.floor(options.evaluationBars)));
  const stepBars = Math.max(1, Math.min(12, Math.floor(options.stepBars)));
  const maxSignals = Math.max(1, Math.min(250, Math.floor(options.maxSignals)));
  const allowedStates = new Set(options.states);
  const seenFormations = new Set<string>();
  const signals: ReplaySignal[] = [];

  if (candles.length < warmupBars + evaluationBars + 1) return signals;

  const finalDetectionIndex = candles.length - evaluationBars - 1;
  for (let index = warmupBars - 1; index <= finalDetectionIndex; index += stepBars) {
    const history = candles.slice(0, index + 1);
    const detected = detectPattern(symbol, history, { lookbackBars: warmupBars });
    if (!detected) continue;
    if (detected.score < options.minScore) continue;
    if (gradeRank[detected.grade] < gradeRank[options.minGrade]) continue;
    if (!allowedStates.has(detected.state)) continue;

    const key = formationKey(detected.fingerprint);
    if (seenFormations.has(key)) continue;
    seenFormations.add(key);

    const future = candles.slice(index + 1, index + 1 + evaluationBars);
    const evaluated = evaluateFutureOutcome({
      direction: detected.direction,
      entryPrice: detected.price,
      breakoutBoundary: detected.breakoutBoundary,
      invalidationBoundary: detected.invalidationBoundary,
      future,
    });

    signals.push({
      detectedAt: detected.detectedAt,
      pattern: detected.pattern,
      direction: detected.direction,
      state: detected.state,
      score: detected.score,
      grade: detected.grade,
      entryPrice: detected.price,
      breakoutBoundary: detected.breakoutBoundary,
      invalidationBoundary: detected.invalidationBoundary,
      ...evaluated,
    });

    if (signals.length >= maxSignals) break;
  }

  return signals;
}
