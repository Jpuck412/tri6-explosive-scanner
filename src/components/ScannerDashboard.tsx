"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiError, PatternResult, ScanResponse } from "@/lib/types";
import { StructureChart } from "./StructureChart";

const patternName: Record<PatternResult["pattern"], string> = {
  ASCENDING_TRIANGLE: "Ascending Triangle",
  DESCENDING_TRIANGLE: "Descending Triangle",
  BULLISH_SYMMETRICAL_TRIANGLE: "Bullish Symmetrical",
  BEARISH_SYMMETRICAL_TRIANGLE: "Bearish Symmetrical",
  FALLING_WEDGE: "Falling Wedge",
  RISING_WEDGE: "Rising Wedge",
};

const stateClass: Record<PatternResult["state"], string> = {
  FORMING: "neutral",
  COMPRESSED: "purple",
  READY: "blue",
  BREAKING: "amber",
  CONFIRMED: "green",
};

interface FormState {
  symbols: string;
  minScore: number;
  direction: "ALL" | "BULLISH" | "BEARISH";
  timeframe: "1m" | "5m" | "15m" | "1h" | "1d";
  autoRefresh: boolean;
  accessToken: string;
}

function parseTimeframe(value: FormState["timeframe"]) {
  if (value === "1h") return { timespan: "hour" as const, multiplier: 1 };
  if (value === "1d") return { timespan: "day" as const, multiplier: 1 };
  return { timespan: "minute" as const, multiplier: Number(value.replace("m", "")) };
}

export function ScannerDashboard() {
  const [form, setForm] = useState<FormState>({
    symbols: "",
    minScore: 68,
    direction: "ALL",
    timeframe: "1m",
    autoRefresh: false,
    accessToken: "",
  });
  const [data, setData] = useState<ScanResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState(0);
  const scanLock = useRef(false);

  const scan = useCallback(async () => {
    if (scanLock.current) return;
    scanLock.current = true;
    setLoading(true);
    setError(null);
    const timeframe = parseTimeframe(form.timeframe);
    const symbols = form.symbols
      .split(/[\s,]+/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (form.accessToken.trim()) headers["x-tri6-token"] = form.accessToken.trim();

      const response = await fetch("/api/scan", {
        method: "POST",
        headers,
        body: JSON.stringify({
          symbols: symbols.length ? symbols : undefined,
          minScore: form.minScore,
          direction: form.direction,
          ...timeframe,
        }),
      });
      const body = await response.json() as ScanResponse | ApiError;
      if (!response.ok || body.ok === false) {
        setError(body as ApiError);
        setData(null);
      } else {
        setData(body as ScanResponse);
        setLastRun(Date.now());
      }
    } catch (cause) {
      setError({ ok: false, code: "NETWORK_ERROR", message: "Scanner API is unreachable.", detail: cause instanceof Error ? cause.message : undefined });
    } finally {
      scanLock.current = false;
      setLoading(false);
    }
  }, [form.accessToken, form.direction, form.minScore, form.symbols, form.timeframe]);

  useEffect(() => {
    if (!form.autoRefresh) return;
    const timer = window.setInterval(() => void scan(), 20_000);
    return () => window.clearInterval(timer);
  }, [form.autoRefresh, scan]);

  const summary = useMemo(() => {
    if (!data) return { bullish: 0, bearish: 0, ready: 0 };
    return {
      bullish: data.results.filter((item) => item.direction === "BULLISH").length,
      bearish: data.results.filter((item) => item.direction === "BEARISH").length,
      ready: data.results.filter((item) => ["READY", "BREAKING", "CONFIRMED"].includes(item.state)).length,
    };
  }, [data]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">PRICE STRUCTURE / LIVE ENGINE</div>
          <h1>TRI<span>6</span></h1>
          <p className="subtitle">Six compression formations. One geometry engine. Zero indicator clutter.</p>
        </div>
        <div className="live-badge"><i /> LIVE DATA ONLY</div>
      </header>

      <section className="control-panel depth-panel">
        <div className="control-grid">
          <label>
            <span>Symbols <small>blank = auto universe</small></span>
            <input
              value={form.symbols}
              onChange={(e) => setForm((current) => ({ ...current, symbols: e.target.value }))}
              placeholder="RGC, CPHI, RAIN"
              autoCapitalize="characters"
            />
          </label>
          <label>
            <span>Timeframe</span>
            <select value={form.timeframe} onChange={(e) => setForm((current) => ({ ...current, timeframe: e.target.value as FormState["timeframe"] }))}>
              <option value="1m">1 minute</option>
              <option value="5m">5 minute</option>
              <option value="15m">15 minute</option>
              <option value="1h">1 hour</option>
              <option value="1d">1 day</option>
            </select>
          </label>
          <label>
            <span>Minimum TRI6 Score</span>
            <div className="range-row">
              <input type="range" min="50" max="95" step="1" value={form.minScore} onChange={(e) => setForm((current) => ({ ...current, minScore: Number(e.target.value) }))} />
              <strong>{form.minScore}</strong>
            </div>
          </label>
          <label>
            <span>Direction</span>
            <select value={form.direction} onChange={(e) => setForm((current) => ({ ...current, direction: e.target.value as FormState["direction"] }))}>
              <option value="ALL">All</option>
              <option value="BULLISH">Bullish</option>
              <option value="BEARISH">Bearish</option>
            </select>
          </label>
        </div>
        <div className="action-row">
          <button className="scan-button" onClick={() => void scan()} disabled={loading}>
            {loading ? <><span className="spinner" /> SCANNING STRUCTURE</> : "RUN TRI6 SCAN"}
          </button>
          <label className="switch-row">
            <input type="checkbox" checked={form.autoRefresh} onChange={(e) => setForm((current) => ({ ...current, autoRefresh: e.target.checked }))} />
            <span>20s live refresh</span>
          </label>
        </div>
        <details className="security-details">
          <summary>Deployment security</summary>
          <label>
            <span>Scanner access token <small>kept in memory only</small></span>
            <input
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm((current) => ({ ...current, accessToken: e.target.value }))}
              placeholder="SCANNER_ACCESS_TOKEN"
              autoComplete="off"
            />
          </label>
        </details>
        <p className="micro-note">Universe price/volume controls only limit API workload. They do not add points to, subtract from, or alter the TRI6 geometry score.</p>
      </section>

      {error && (
        <section className="error-panel depth-panel">
          <div className="error-code">{error.code}</div>
          <strong>{error.message}</strong>
          {error.detail && <p>{error.detail}</p>}
        </section>
      )}

      <section className="stat-grid">
        <article className="stat depth-panel"><span>SCANNED</span><strong>{data?.scanned ?? "—"}</strong><small>{data?.universeMode ?? "WAITING"}</small></article>
        <article className="stat depth-panel"><span>MATCHES</span><strong>{data?.matched ?? "—"}</strong><small>score-qualified</small></article>
        <article className="stat depth-panel bullish"><span>BULLISH</span><strong>{data ? summary.bullish : "—"}</strong><small>geometry bias</small></article>
        <article className="stat depth-panel bearish"><span>BEARISH</span><strong>{data ? summary.bearish : "—"}</strong><small>geometry bias</small></article>
        <article className="stat depth-panel hot"><span>ACTION ZONE</span><strong>{data ? summary.ready : "—"}</strong><small>ready / breaking / confirmed</small></article>
      </section>

      <section className="pattern-strip depth-panel" aria-label="TRI6 formations">
        {[
          ["▲", "Ascending Triangle", "bull"],
          ["▼", "Descending Triangle", "bear"],
          ["◇", "Bullish Symmetrical", "bull"],
          ["◇", "Bearish Symmetrical", "bear"],
          ["⌄", "Falling Wedge", "bull"],
          ["⌃", "Rising Wedge", "bear"],
        ].map(([icon, name, tone]) => (
          <div className={`pattern-chip ${tone}`} key={name}><b>{icon}</b><span>{name}</span></div>
        ))}
      </section>

      <section className="results-section">
        <div className="section-heading">
          <div><span className="eyebrow">RANKED EVIDENCE</span><h2>Detected Structures</h2></div>
          {data && <div className="scan-meta">{data.elapsedMs.toLocaleString()} ms · {new Date(data.generatedAt).toLocaleTimeString()}</div>}
        </div>

        {!data && !error && (
          <div className="empty-state depth-panel">
            <div className="radar-ring"><span /></div>
            <h3>Engine standing by</h3>
            <p>Run a live scan. TRI6 rejects structures that do not satisfy its six geometric pattern definitions.</p>
          </div>
        )}

        {data?.results.length === 0 && (
          <div className="empty-state depth-panel">
            <h3>No qualified geometry</h3>
            <p>The scanned universe produced no six-pattern match at or above the current score threshold. TRI6 does not force labels.</p>
          </div>
        )}

        <div className="result-grid">
          {data?.results.map((result, index) => (
            <article className={`result-card depth-panel ${result.direction.toLowerCase()}`} key={`${result.symbol}-${result.pattern}`}>
              <div className="rank">#{String(index + 1).padStart(2, "0")}</div>
              <div className="result-head">
                <div><h3>{result.symbol}</h3><p>{patternName[result.pattern]}</p></div>
                <div className="score-dial"><strong>{result.score}</strong><span>TRI6</span></div>
              </div>
              <div className="badges">
                <span className={result.direction === "BULLISH" ? "green" : "red"}>{result.direction}</span>
                <span className={stateClass[result.state]}>{result.state}</span>
              </div>
              <StructureChart result={result} />
              <div className="price-line">
                <div><span>PRICE</span><strong>${result.price}</strong></div>
                <div><span>BREAK</span><strong>${result.breakoutBoundary}</strong></div>
                <div><span>INVALIDATE</span><strong>${result.invalidationBoundary}</strong></div>
              </div>
              <div className="evidence-grid">
                <Metric label="Compression" value={`${result.evidence.compressionPct}%`} score={result.evidence.compressionScore} />
                <Metric label="Containment" value={`${result.evidence.containmentPct}%`} score={result.evidence.containmentScore} />
                <Metric label="Touches" value={`${result.evidence.upperTouches}+${result.evidence.lowerTouches}`} score={result.evidence.touchScore} />
                <Metric label="Line Fit" value={`${result.evidence.fitScore}`} score={result.evidence.fitScore} />
                <Metric label="Apex" value={`${result.evidence.apexProgressPct}%`} score={result.evidence.convergenceScore} />
                <Metric label="To Break" value={`${result.evidence.breakoutDistancePct}%`} score={result.evidence.proximityScore} />
              </div>
              <details>
                <summary>Geometry evidence</summary>
                <div className="detail-list">
                  <span>Upper slope <b>{result.evidence.upperSlopePctPerBar}%/bar</b></span>
                  <span>Lower slope <b>{result.evidence.lowerSlopePctPerBar}%/bar</b></span>
                  <span>Upper R² <b>{result.evidence.upperR2}</b></span>
                  <span>Lower R² <b>{result.evidence.lowerR2}</b></span>
                  <span>Current width <b>{result.evidence.currentWidthPct}%</b></span>
                </div>
              </details>
            </article>
          ))}
        </div>
      </section>

      <footer>
        TRI6 analyzes geometric price structure only. A detected or confirmed pattern is evidence of structure, not a guarantee of outcome.
        {lastRun > 0 && <span> Last successful client run: {new Date(lastRun).toLocaleTimeString()}.</span>}
      </footer>
    </main>
  );
}

function Metric({ label, value, score }: { label: string; value: string; score: number }) {
  return (
    <div className="metric">
      <div><span>{label}</span><b>{value}</b></div>
      <div className="meter"><i style={{ width: `${Math.max(4, Math.min(100, score))}%` }} /></div>
    </div>
  );
}
