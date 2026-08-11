"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ApiError, EngineStatus, PatternResult, PatternState, QualityGrade, ScanResponse } from "@/lib/types";
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

const gradeRank: Record<QualityGrade, number> = { "A+": 4, A: 3, B: 2, C: 1 };

interface FormState {
  symbols: string;
  minScore: number;
  minGrade: QualityGrade;
  direction: "ALL" | "BULLISH" | "BEARISH";
  timeframe: "1m" | "5m" | "15m" | "1h" | "1d";
  stateFilter: "ALL" | "ACTION" | PatternState;
  autoRefresh: boolean;
  accessToken: string;
}

type SortMode = "STATE" | "SCORE" | "BREAKOUT";

function parseTimeframe(value: FormState["timeframe"]) {
  if (value === "1h") return { timespan: "hour" as const, multiplier: 1 };
  if (value === "1d") return { timespan: "day" as const, multiplier: 1 };
  return { timespan: "minute" as const, multiplier: Number(value.replace("m", "")) };
}

function statesForFilter(value: FormState["stateFilter"]): PatternState[] | undefined {
  if (value === "ALL") return undefined;
  if (value === "ACTION") return ["READY", "BREAKING", "CONFIRMED"];
  return [value];
}

function money(value: number): string {
  if (value < 1) return `$${value.toFixed(4)}`;
  if (value < 10) return `$${value.toFixed(3)}`;
  return `$${value.toFixed(2)}`;
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

export function ScannerDashboard() {
  const [form, setForm] = useState<FormState>({
    symbols: "",
    minScore: 72,
    minGrade: "B",
    direction: "ALL",
    timeframe: "1m",
    stateFilter: "ALL",
    autoRefresh: false,
    accessToken: "",
  });
  const [data, setData] = useState<ScanResponse | null>(null);
  const [status, setStatus] = useState<EngineStatus | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRun, setLastRun] = useState(0);
  const [resultSearch, setResultSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("STATE");
  const scanLock = useRef(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/status", { cache: "no-store" })
      .then((response) => response.json() as Promise<EngineStatus>)
      .then((body) => { if (active && body.ok) setStatus(body); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

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
        cache: "no-store",
        body: JSON.stringify({
          symbols: symbols.length ? symbols : undefined,
          minScore: form.minScore,
          minGrade: form.minGrade,
          direction: form.direction,
          states: statesForFilter(form.stateFilter),
          maxResults: 60,
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
      setError({
        ok: false,
        code: "NETWORK_ERROR",
        message: "Scanner API is unreachable.",
        detail: cause instanceof Error ? cause.message : undefined,
      });
    } finally {
      scanLock.current = false;
      setLoading(false);
    }
  }, [form.accessToken, form.direction, form.minGrade, form.minScore, form.stateFilter, form.symbols, form.timeframe]);

  useEffect(() => {
    if (!form.autoRefresh) return;
    const timer = window.setInterval(() => void scan(), 20_000);
    return () => window.clearInterval(timer);
  }, [form.autoRefresh, scan]);

  const summary = useMemo(() => {
    if (!data) return { bullish: 0, bearish: 0, ready: 0, elite: 0 };
    return {
      bullish: data.results.filter((item) => item.direction === "BULLISH").length,
      bearish: data.results.filter((item) => item.direction === "BEARISH").length,
      ready: data.results.filter((item) => ["READY", "BREAKING", "CONFIRMED"].includes(item.state)).length,
      elite: data.results.filter((item) => gradeRank[item.grade] >= gradeRank.A).length,
    };
  }, [data]);

  const visibleResults = useMemo(() => {
    const statePriority: Record<PatternState, number> = { CONFIRMED: 5, BREAKING: 4, READY: 3, COMPRESSED: 2, FORMING: 1 };
    const query = resultSearch.trim().toUpperCase();
    const rows = data?.results.filter((item) => !query || item.symbol.includes(query) || patternName[item.pattern].toUpperCase().includes(query)) ?? [];
    return [...rows].sort((a, b) => {
      if (sortMode === "SCORE") return b.score - a.score;
      if (sortMode === "BREAKOUT") return a.evidence.breakoutDistancePct - b.evidence.breakoutDistancePct;
      return statePriority[b.state] - statePriority[a.state] || b.score - a.score;
    });
  }, [data, resultSearch, sortMode]);

  const exportCsv = useCallback(() => {
    if (!visibleResults.length) return;
    const header = [
      "symbol", "pattern", "direction", "state", "grade", "score", "price", "breakout", "invalidation",
      "compression_pct", "range_compression_pct", "body_containment_pct", "wick_containment_pct", "touch_spacing",
      "alternation", "apex_progress_pct", "breakout_distance_pct", "formation_bars", "fingerprint",
    ];
    const rows = visibleResults.map((item) => [
      item.symbol, item.pattern, item.direction, item.state, item.grade, item.score, item.price, item.breakoutBoundary,
      item.invalidationBoundary, item.evidence.compressionPct, item.evidence.rangeCompressionPct, item.evidence.bodyContainmentPct,
      item.evidence.wickContainmentPct, item.evidence.touchSpacingScore, item.evidence.alternationScore,
      item.evidence.apexProgressPct, item.evidence.breakoutDistancePct, item.evidence.formationBars, item.fingerprint,
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tri6-${form.timeframe}-${new Date().toISOString().replaceAll(":", "-")}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }, [form.timeframe, visibleResults]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">PROFESSIONAL PRICE STRUCTURE / LIVE ENGINE</div>
          <h1>TRI<span>6</span> <em className="elite-mark">ELITE</em></h1>
          <p className="subtitle">Six compression formations. Robust geometry. Distributed-touch proof. No indicator soup.</p>
        </div>
        <div className={`live-badge ${status?.providerConfigured ? "provider-on" : "provider-off"}`}>
          <i /> {status?.providerConfigured ? "LIVE PROVIDER READY" : "LIVE KEY REQUIRED"}
        </div>
      </header>

      <section className="operator-strip depth-panel">
        <div><span>ENGINE</span><strong>{status ? `v${status.version}` : "—"}</strong></div>
        <div><span>MODE</span><strong>GEOMETRY ONLY</strong></div>
        <div><span>PROVIDER</span><strong>{status?.providerConfigured ? "CONNECTED" : "NOT CONFIGURED"}</strong></div>
        <div><span>RUNTIME</span><strong>LIVE DATA ONLY</strong></div>
      </section>

      <section className="control-panel depth-panel">
        <div className="control-grid elite-controls">
          <label>
            <span>Symbols <small>blank = auto universe</small></span>
            <input value={form.symbols} onChange={(e) => setForm((current) => ({ ...current, symbols: e.target.value }))} placeholder="RGC, CPHI, RAIN" autoCapitalize="characters" />
          </label>
          <label>
            <span>Timeframe</span>
            <select value={form.timeframe} onChange={(e) => setForm((current) => ({ ...current, timeframe: e.target.value as FormState["timeframe"] }))}>
              <option value="1m">1 minute</option><option value="5m">5 minute</option><option value="15m">15 minute</option><option value="1h">1 hour</option><option value="1d">1 day</option>
            </select>
          </label>
          <label>
            <span>Minimum TRI6 Score</span>
            <div className="range-row"><input type="range" min="60" max="95" step="1" value={form.minScore} onChange={(e) => setForm((current) => ({ ...current, minScore: Number(e.target.value) }))} /><strong>{form.minScore}</strong></div>
          </label>
          <label>
            <span>Minimum Grade</span>
            <select value={form.minGrade} onChange={(e) => setForm((current) => ({ ...current, minGrade: e.target.value as QualityGrade }))}>
              <option value="C">C or better</option><option value="B">B or better</option><option value="A">A or better</option><option value="A+">A+ only</option>
            </select>
          </label>
          <label>
            <span>Direction</span>
            <select value={form.direction} onChange={(e) => setForm((current) => ({ ...current, direction: e.target.value as FormState["direction"] }))}>
              <option value="ALL">All</option><option value="BULLISH">Bullish</option><option value="BEARISH">Bearish</option>
            </select>
          </label>
          <label>
            <span>Structure State</span>
            <select value={form.stateFilter} onChange={(e) => setForm((current) => ({ ...current, stateFilter: e.target.value as FormState["stateFilter"] }))}>
              <option value="ALL">All qualified</option><option value="ACTION">Action zone only</option><option value="FORMING">Forming</option><option value="COMPRESSED">Compressed</option><option value="READY">Ready</option><option value="BREAKING">Breaking</option><option value="CONFIRMED">Confirmed</option>
            </select>
          </label>
        </div>
        <div className="action-row">
          <button className="scan-button" onClick={() => void scan()} disabled={loading}>{loading ? <><span className="spinner" /> SCANNING STRUCTURE</> : "RUN TRI6 ELITE SCAN"}</button>
          <label className="switch-row"><input type="checkbox" checked={form.autoRefresh} onChange={(e) => setForm((current) => ({ ...current, autoRefresh: e.target.checked }))} /><span>20s live refresh</span></label>
        </div>
        <details className="security-details">
          <summary>Deployment security</summary>
          <label><span>Scanner access token <small>memory-only; never persisted</small></span><input type="password" value={form.accessToken} onChange={(e) => setForm((current) => ({ ...current, accessToken: e.target.value }))} placeholder="SCANNER_ACCESS_TOKEN" autoComplete="off" /></label>
        </details>
        <p className="micro-note">Price and day-volume settings only choose which symbols the provider must inspect. TRI6 score remains 100% geometric price-structure evidence.</p>
      </section>

      {error && <section className="error-panel depth-panel"><div className="error-code">{error.code}</div><strong>{error.message}</strong>{error.detail && <p>{error.detail}</p>}{error.requestId && <small>Request {error.requestId}</small>}</section>}

      <section className="stat-grid">
        <article className="stat depth-panel"><span>SCANNED</span><strong>{data?.scanned ?? "—"}</strong><small>{data?.universeMode ?? "WAITING"}</small></article>
        <article className="stat depth-panel"><span>DETECTED</span><strong>{data?.detected ?? "—"}</strong><small>elite geometry gate</small></article>
        <article className="stat depth-panel"><span>MATCHES</span><strong>{data?.matched ?? "—"}</strong><small>operator filters</small></article>
        <article className="stat depth-panel bullish"><span>BULLISH</span><strong>{data ? summary.bullish : "—"}</strong><small>geometry bias</small></article>
        <article className="stat depth-panel bearish"><span>BEARISH</span><strong>{data ? summary.bearish : "—"}</strong><small>geometry bias</small></article>
        <article className="stat depth-panel hot"><span>A / A+</span><strong>{data ? summary.elite : "—"}</strong><small>highest structural grade</small></article>
        <article className="stat depth-panel hot"><span>ACTION ZONE</span><strong>{data ? summary.ready : "—"}</strong><small>ready / breaking / confirmed</small></article>
      </section>

      <section className="pattern-strip depth-panel" aria-label="TRI6 formations">
        {[["▲", "Ascending Triangle", "bull"], ["▼", "Descending Triangle", "bear"], ["◇", "Bullish Symmetrical", "bull"], ["◇", "Bearish Symmetrical", "bear"], ["⌄", "Falling Wedge", "bull"], ["⌃", "Rising Wedge", "bear"]].map(([icon, name, tone]) => <div className={`pattern-chip ${tone}`} key={name}><b>{icon}</b><span>{name}</span></div>)}
      </section>

      <section className="results-section">
        <div className="section-heading"><div><span className="eyebrow">RANKED STRUCTURAL PROOF</span><h2>Detected Structures</h2></div>{data && <div className="scan-meta">{data.timeframe} · {data.elapsedMs.toLocaleString()} ms · {new Date(data.generatedAt).toLocaleTimeString()}</div>}</div>

        {data && <div className="result-toolbar depth-panel"><input value={resultSearch} onChange={(e) => setResultSearch(e.target.value)} placeholder="Filter ticker or pattern" /><select value={sortMode} onChange={(e) => setSortMode(e.target.value as SortMode)}><option value="STATE">Sort: state</option><option value="SCORE">Sort: score</option><option value="BREAKOUT">Sort: nearest break</option></select><button type="button" onClick={exportCsv} disabled={!visibleResults.length}>EXPORT CSV</button></div>}

        {!data && !error && <div className="empty-state depth-panel"><div className="radar-ring"><span /></div><h3>Elite engine standing by</h3><p>Run a live scan. TRI6 rejects weak fit, clustered touches, poor alternation, low containment and non-converging structures before ranking anything.</p></div>}
        {data?.results.length === 0 && <div className="empty-state depth-panel"><h3>No qualified geometry</h3><p>The scanned universe produced no six-pattern structure strong enough for the current professional gates and operator filters. Nothing is force-labeled.</p></div>}

        <div className="result-grid">
          {visibleResults.map((result, index) => (
            <article className={`result-card depth-panel ${result.direction.toLowerCase()}`} key={result.fingerprint}>
              <div className="rank">#{String(index + 1).padStart(2, "0")}</div>
              <div className="result-head"><div><h3>{result.symbol}</h3><p>{patternName[result.pattern]}</p></div><div className="score-stack"><div className={`grade-badge grade-${result.grade.replace("+", "plus")}`}>{result.grade}</div><div className="score-dial"><strong>{result.score}</strong><span>TRI6</span></div></div></div>
              <div className="badges"><span className={result.direction === "BULLISH" ? "green" : "red"}>{result.direction}</span><span className={stateClass[result.state]}>{result.state}</span><span className="neutral">{result.evidence.formationBars} BARS</span></div>
              <StructureChart result={result} />
              <div className="price-line"><div><span>PRICE</span><strong>{money(result.price)}</strong></div><div><span>PROOF LEVEL</span><strong>{money(result.breakoutBoundary)}</strong></div><div><span>FAIL LEVEL</span><strong>{money(result.invalidationBoundary)}</strong></div></div>

              <div className="proof-box"><span>WHAT PROVES IT</span><p>{result.proof.confirmation}</p><span>WHAT KILLS IT</span><p>{result.proof.invalidation}</p></div>

              <div className="evidence-grid elite-evidence">
                <Metric label="Line Fit" value={`${result.evidence.fitScore}`} score={result.evidence.fitScore} />
                <Metric label="Compression" value={`${result.evidence.compressionPct}%`} score={result.evidence.compressionScore} />
                <Metric label="Range Squeeze" value={`${result.evidence.rangeCompressionPct}%`} score={result.evidence.compressionScore} />
                <Metric label="Body Hold" value={`${result.evidence.bodyContainmentPct}%`} score={result.evidence.containmentScore} />
                <Metric label="Wick Hold" value={`${result.evidence.wickContainmentPct}%`} score={result.evidence.containmentScore} />
                <Metric label="Touches" value={`${result.evidence.upperTouches}+${result.evidence.lowerTouches}`} score={result.evidence.touchScore} />
                <Metric label="Touch Spread" value={`${result.evidence.touchSpacingScore}`} score={result.evidence.touchSpacingScore} />
                <Metric label="Alternation" value={`${result.evidence.alternationScore}`} score={result.evidence.alternationScore} />
                <Metric label="Apex" value={`${result.evidence.apexProgressPct}%`} score={result.evidence.convergenceScore} />
                <Metric label="To Break" value={`${result.evidence.breakoutDistancePct}%`} score={result.evidence.proximityScore} />
              </div>
              <details><summary>Full geometry evidence</summary><div className="detail-list"><span>Structure <b>{result.proof.structure}</b></span><span>Upper slope <b>{result.evidence.upperSlopePctPerBar}%/bar</b></span><span>Lower slope <b>{result.evidence.lowerSlopePctPerBar}%/bar</b></span><span>Upper R² <b>{result.evidence.upperR2}</b></span><span>Lower R² <b>{result.evidence.lowerR2}</b></span><span>Upper inliers <b>{result.evidence.upperInlierPct}%</b></span><span>Lower inliers <b>{result.evidence.lowerInlierPct}%</b></span><span>Violation rate <b>{result.evidence.violationPct}%</b></span><span>Current width <b>{result.evidence.currentWidthPct}%</b></span><span>Invalidation distance <b>{result.evidence.invalidationDistancePct}%</b></span><span>Apex bars away <b>{result.evidence.apexBarsAway ?? "parallel"}</b></span><span>Fingerprint <b className="fingerprint">{result.fingerprint}</b></span></div></details>
            </article>
          ))}
        </div>

        {data && data.failures.length > 0 && <details className="security-details"><summary>Provider diagnostics ({data.failures.length})</summary><div className="detail-list">{data.failures.map((failure) => <span key={`${failure.symbol}-${failure.reason}`}><b>{failure.symbol}</b> {failure.reason}</span>)}</div></details>}
      </section>

      <footer>TRI6 ELITE analyzes geometric price structure only. A confirmed pattern is structural evidence, not a guarantee of future price movement.{lastRun > 0 && <span> Last successful client run: {new Date(lastRun).toLocaleTimeString()}.</span>}</footer>
    </main>
  );
}

function Metric({ label, value, score }: { label: string; value: string; score: number }) {
  return <div className="metric"><div><span>{label}</span><b>{value}</b></div><div className="meter"><i style={{ width: `${Math.max(4, Math.min(100, score))}%` }} /></div></div>;
}
