"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "@/app/lab/lab.module.css";
import type { ApiError, ReplayPatternStats, ReplayResponse } from "@/lib/types";

const patternNames: Record<string, string> = {
  ASCENDING_TRIANGLE: "Ascending Triangle",
  DESCENDING_TRIANGLE: "Descending Triangle",
  BULLISH_SYMMETRICAL_TRIANGLE: "Bullish Symmetrical",
  BEARISH_SYMMETRICAL_TRIANGLE: "Bearish Symmetrical",
  FALLING_WEDGE: "Falling Wedge",
  RISING_WEDGE: "Rising Wedge",
};

interface FormState {
  symbol: string;
  timeframe: "1m" | "5m" | "15m" | "1h" | "1d";
  historyBars: number;
  evaluationBars: number;
  stepBars: number;
  minScore: number;
  minGrade: "A+" | "A" | "B" | "C";
  accessToken: string;
}

function parseTimeframe(value: FormState["timeframe"]) {
  if (value === "1h") return { timespan: "hour" as const, multiplier: 1 };
  if (value === "1d") return { timespan: "day" as const, multiplier: 1 };
  return { timespan: "minute" as const, multiplier: Number(value.replace("m", "")) };
}

function outcomeClass(outcome: string): string {
  if (outcome === "PROOF_FIRST") return styles.proof;
  if (outcome === "INVALIDATION_FIRST") return styles.invalid;
  if (outcome === "AMBIGUOUS") return styles.ambiguous;
  return styles.neither;
}

function pct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function ValidationLab() {
  const [form, setForm] = useState<FormState>({
    symbol: "",
    timeframe: "1m",
    historyBars: 500,
    evaluationBars: 12,
    stepBars: 1,
    minScore: 74,
    minGrade: "B",
    accessToken: "",
  });
  const [data, setData] = useState<ReplayResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);

  const byPattern = useMemo(
    () => data
      ? (Object.entries(data.byPattern) as [string, ReplayPatternStats][]).sort((a, b) => b[1].signals - a[1].signals)
      : [],
    [data],
  );

  async function runReplay() {
    const symbol = form.symbol.trim().toUpperCase();
    if (!symbol) {
      setError({ ok: false, code: "SYMBOL_REQUIRED", message: "Enter one ticker to validate." });
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (form.accessToken.trim()) headers["x-tri6-token"] = form.accessToken.trim();
      const response = await fetch("/api/replay", {
        method: "POST",
        headers,
        body: JSON.stringify({
          symbol,
          ...parseTimeframe(form.timeframe),
          historyBars: form.historyBars,
          evaluationBars: form.evaluationBars,
          stepBars: form.stepBars,
          minScore: form.minScore,
          minGrade: form.minGrade,
          states: ["READY", "BREAKING"],
          maxSignals: 150,
        }),
      });
      const body = await response.json() as ReplayResponse | ApiError;
      if (!response.ok || body.ok === false) {
        setData(null);
        setError(body as ApiError);
      } else {
        setData(body as ReplayResponse);
      }
    } catch (cause) {
      setData(null);
      setError({
        ok: false,
        code: "NETWORK_ERROR",
        message: "Validation API is unreachable.",
        detail: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div>
          <div className={styles.kicker}>TRI6 ELITE / WALK-FORWARD VALIDATION</div>
          <h1 className={styles.title}>VALIDATION <span>LAB</span></h1>
          <p className={styles.subtitle}>
            Replays historical candles one bar at a time and asks whether a READY/BREAKING TRI6 structure reached its proof boundary before structural invalidation. Detection only sees candles available at that historical moment.
          </p>
        </div>
        <Link className={styles.back} href="/">← SCANNER</Link>
      </header>

      <section className={`${styles.panel} ${styles.controls}`}>
        <div className={styles.grid}>
          <label className={styles.label}>
            <span>Ticker</span>
            <input
              className={styles.input}
              value={form.symbol}
              onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value.toUpperCase() }))}
              placeholder="CPHI"
              maxLength={12}
              autoCapitalize="characters"
            />
          </label>
          <label className={styles.label}>
            <span>Timeframe</span>
            <select className={styles.select} value={form.timeframe} onChange={(event) => setForm((current) => ({ ...current, timeframe: event.target.value as FormState["timeframe"] }))}>
              <option value="1m">1 minute</option>
              <option value="5m">5 minute</option>
              <option value="15m">15 minute</option>
              <option value="1h">1 hour</option>
              <option value="1d">1 day</option>
            </select>
          </label>
          <label className={styles.label}>
            <span>History</span>
            <select className={styles.select} value={form.historyBars} onChange={(event) => setForm((current) => ({ ...current, historyBars: Number(event.target.value) }))}>
              <option value="300">300 bars</option>
              <option value="400">400 bars</option>
              <option value="500">500 bars</option>
              <option value="600">600 bars</option>
            </select>
          </label>
          <label className={styles.label}>
            <span>Outcome Horizon</span>
            <select className={styles.select} value={form.evaluationBars} onChange={(event) => setForm((current) => ({ ...current, evaluationBars: Number(event.target.value) }))}>
              <option value="6">6 bars</option>
              <option value="12">12 bars</option>
              <option value="20">20 bars</option>
              <option value="30">30 bars</option>
            </select>
          </label>
          <label className={styles.label}>
            <span>Minimum Score</span>
            <select className={styles.select} value={form.minScore} onChange={(event) => setForm((current) => ({ ...current, minScore: Number(event.target.value) }))}>
              <option value="72">72</option>
              <option value="74">74</option>
              <option value="78">78</option>
              <option value="82">82</option>
              <option value="86">86</option>
              <option value="90">90</option>
            </select>
          </label>
          <label className={styles.label}>
            <span>Minimum Grade</span>
            <select className={styles.select} value={form.minGrade} onChange={(event) => setForm((current) => ({ ...current, minGrade: event.target.value as FormState["minGrade"] }))}>
              <option value="C">C+</option>
              <option value="B">B</option>
              <option value="A">A</option>
              <option value="A+">A+</option>
            </select>
          </label>
        </div>

        <div className={styles.actions}>
          <button className={styles.button} onClick={() => void runReplay()} disabled={loading}>
            {loading ? "REPLAYING BAR BY BAR…" : "RUN WALK-FORWARD VALIDATION"}
          </button>
          <div className={styles.note}>
            Detection states: READY + BREAKING · Step: {form.stepBars} bar · No future candles are supplied to the detector.
          </div>
        </div>

        <details className={styles.security}>
          <summary>Deployment security</summary>
          <label className={styles.label}>
            <span>Scanner access token — memory only</span>
            <input
              className={styles.input}
              type="password"
              value={form.accessToken}
              onChange={(event) => setForm((current) => ({ ...current, accessToken: event.target.value }))}
              placeholder="SCANNER_ACCESS_TOKEN"
              autoComplete="off"
            />
          </label>
        </details>
      </section>

      {error && (
        <section className={`${styles.panel} ${styles.error}`}>
          <b>{error.code}</b>
          <strong>{error.message}</strong>
          {error.detail && <p>{error.detail}</p>}
        </section>
      )}

      {data && (
        <>
          <section className={styles.stats}>
            <Stat label="SIGNALS" value={String(data.summary.signals)} note={`${data.historyBars} bars tested`} />
            <Stat label="PROOF FIRST" value={`${data.summary.proofFirstRatePct}%`} note={`${data.summary.proofFirst} structures`} tone="good" />
            <Stat label="INVALIDATED" value={String(data.summary.invalidationFirst)} note="before proof" tone="bad" />
            <Stat label="AVG MFE" value={pct(data.summary.avgMfePct)} note="favorable excursion" tone="good" />
            <Stat label="AVG MAE" value={`-${data.summary.avgMaePct.toFixed(2)}%`} note="adverse excursion" tone="bad" />
            <Stat label="END RETURN" value={pct(data.summary.avgEndReturnPct)} note={`${data.evaluationBars}-bar directional`} tone={data.summary.avgEndReturnPct >= 0 ? "good" : "bad"} />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <div><div className={styles.kicker}>STRUCTURE BREAKDOWN</div><h2>Performance by Pattern</h2></div>
              <p>{data.symbol} · {data.timeframe} · {data.elapsedMs.toLocaleString()} ms</p>
            </div>
            {byPattern.length ? (
              <div className={styles.patternGrid}>
                {byPattern.map(([pattern, stats]) => (
                  <article className={`${styles.panel} ${styles.pattern}`} key={pattern}>
                    <h3>{patternNames[pattern] ?? pattern}</h3>
                    <div className={styles.patternMetrics}>
                      <div><span>SIGNALS</span><b>{stats.signals}</b></div>
                      <div><span>PROOF FIRST</span><b className={styles.good}>{stats.proofFirstRatePct}%</b></div>
                      <div><span>INVALID</span><b className={styles.bad}>{stats.invalidationFirst}</b></div>
                      <div><span>AVG MFE</span><b>{pct(stats.avgMfePct)}</b></div>
                      <div><span>AVG MAE</span><b>-{stats.avgMaePct.toFixed(2)}%</b></div>
                      <div><span>END</span><b>{pct(stats.avgEndReturnPct)}</b></div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={`${styles.panel} ${styles.empty}`}>
                <div><h3>No historical action-zone structures</h3><p>The detector found no unique READY/BREAKING formations that passed the selected structural score and grade gates in this window. TRI6 does not manufacture replay signals.</p></div>
              </div>
            )}
          </section>

          {data.signals.length > 0 && (
            <section className={styles.section}>
              <div className={styles.sectionHead}>
                <div><div className={styles.kicker}>SIGNAL LEDGER</div><h2>Walk-Forward Events</h2></div>
                <p>First appearance per formation is counted once.</p>
              </div>
              <div className={`${styles.panel} ${styles.tableWrap}`}>
                <table className={styles.table}>
                  <thead>
                    <tr><th>Detected</th><th>Pattern</th><th>State</th><th>Score</th><th>Entry</th><th>Proof</th><th>Fail</th><th>Outcome</th><th>MFE</th><th>MAE</th><th>End</th></tr>
                  </thead>
                  <tbody>
                    {[...data.signals].reverse().map((signal, index) => (
                      <tr key={`${signal.detectedAt}-${signal.pattern}-${index}`}>
                        <td>{new Date(signal.detectedAt).toLocaleString()}</td>
                        <td>{patternNames[signal.pattern] ?? signal.pattern}</td>
                        <td>{signal.state}</td>
                        <td>{signal.score} / {signal.grade}</td>
                        <td>${signal.entryPrice}</td>
                        <td>${signal.breakoutBoundary}</td>
                        <td>${signal.invalidationBoundary}</td>
                        <td className={`${styles.outcome} ${outcomeClass(signal.outcome)}`}>{signal.outcome.replaceAll("_", " ")}</td>
                        <td className={styles.good}>{pct(signal.mfePct)}</td>
                        <td className={styles.bad}>-{signal.maePct.toFixed(2)}%</td>
                        <td className={signal.endReturnPct >= 0 ? styles.good : styles.bad}>{pct(signal.endReturnPct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {!data && !error && (
        <section className={`${styles.panel} ${styles.empty}`}>
          <div>
            <h3>Validation engine standing by</h3>
            <p>Choose a ticker and replay it. This lab is separate from live ranking: it measures what happened after historical TRI6 structures without adding performance statistics to the live geometry score.</p>
          </div>
        </section>
      )}

      <footer className={styles.footer}>
        Validation metrics describe historical boundary behavior, not guaranteed future performance or trading profitability. MFE/MAE are directional price excursions from the detection close. Same-bar proof and invalidation sweeps are classified AMBIGUOUS rather than guessed.
        {data && <> Last replay: {new Date(data.generatedAt).toLocaleString()} · Engine {data.engineVersion}.</>}
      </footer>
    </main>
  );
}

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "good" | "bad" | "warn" }) {
  const toneClass = tone === "good" ? styles.good : tone === "bad" ? styles.bad : tone === "warn" ? styles.warn : "";
  return (
    <article className={`${styles.panel} ${styles.stat}`}>
      <span>{label}</span>
      <strong className={toneClass}>{value}</strong>
      <small>{note}</small>
    </article>
  );
}
