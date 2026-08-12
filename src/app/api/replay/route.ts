import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ENGINE_VERSION, scannerConfig } from "@/lib/config";
import { replayCandles, summarizeReplay } from "@/lib/engine/replay";
import { marketDataProvider } from "@/lib/provider";
import { clientKey, consumeScanAllowance, isAuthorized } from "@/lib/security/scanGuard";
import type {
  ApiError,
  PatternState,
  QualityGrade,
  ReplayRequest,
  ReplayResponse,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowedStates = new Set<PatternState>(["FORMING", "COMPRESSED", "READY", "BREAKING", "CONFIRMED"]);
const allowedGrades = new Set<QualityGrade>(["A+", "A", "B", "C"]);
const allowedTimespans = new Set(["minute", "hour", "day"] as const);

function json<T extends ApiError | ReplayResponse>(body: T, status = 200, requestId = randomUUID(), extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Request-Id": requestId,
      "X-TRI6-Engine": ENGINE_VERSION,
      ...extraHeaders,
    },
  });
}

function finiteInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function parseReplayRequest(value: unknown): ReplayRequest | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.symbol !== "string") return null;
  const symbol = input.symbol.trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, "");
  if (!/^[A-Z][A-Z0-9.\-]{0,11}$/.test(symbol)) return null;

  const request: ReplayRequest = { symbol };
  if (typeof input.timespan === "string" && allowedTimespans.has(input.timespan as "minute" | "hour" | "day")) {
    request.timespan = input.timespan as "minute" | "hour" | "day";
  }
  request.multiplier = finiteInt(input.multiplier, 1, 1, 60);
  request.historyBars = finiteInt(input.historyBars, 500, 180, 600);
  request.warmupBars = finiteInt(input.warmupBars, scannerConfig.lookbackBars, 60, 300);
  request.evaluationBars = finiteInt(input.evaluationBars, 12, 1, 60);
  request.stepBars = finiteInt(input.stepBars, 1, 1, 12);
  request.minScore = finiteNumber(input.minScore, Math.max(scannerConfig.minScore, 74), 0, 100);
  request.maxSignals = finiteInt(input.maxSignals, 100, 1, 250);

  if (typeof input.minGrade === "string" && allowedGrades.has(input.minGrade as QualityGrade)) {
    request.minGrade = input.minGrade as QualityGrade;
  } else {
    request.minGrade = "B";
  }

  if (Array.isArray(input.states)) {
    const states = input.states.filter((state): state is PatternState => typeof state === "string" && allowedStates.has(state as PatternState));
    request.states = states.length ? [...new Set(states)] : ["READY", "BREAKING"];
  } else {
    request.states = ["READY", "BREAKING"];
  }

  const minimumHistory = (request.warmupBars ?? scannerConfig.lookbackBars) + (request.evaluationBars ?? 12) + 1;
  request.historyBars = Math.max(request.historyBars ?? 500, Math.min(600, minimumHistory));
  return request;
}

function timeframeLabel(timespan: "minute" | "hour" | "day", multiplier: number): string {
  if (timespan === "minute") return `${multiplier}m`;
  if (timespan === "hour") return `${multiplier}h`;
  return `${multiplier}d`;
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  if (!isAuthorized(request)) {
    return json<ApiError>({ ok: false, code: "UNAUTHORIZED", message: "TRI6 access token is missing or invalid.", requestId }, 401, requestId);
  }

  const allowance = consumeScanAllowance(clientKey(request));
  if (!allowance.allowed) {
    return json<ApiError>({
      ok: false,
      code: "RATE_LIMITED",
      message: "TRI6 validation rate limit reached.",
      detail: `Retry in about ${allowance.retryAfterSeconds} seconds.`,
      requestId,
    }, 429, requestId, { "Retry-After": String(allowance.retryAfterSeconds) });
  }

  if (!marketDataProvider.configured()) {
    return json<ApiError>({
      ok: false,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "A live market-data API key is required for historical validation.",
      detail: "Set POLYGON_API_KEY or MASSIVE_API_KEY in the server environment.",
      requestId,
    }, 503, requestId);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 25_000) {
    return json<ApiError>({ ok: false, code: "REQUEST_TOO_LARGE", message: "Replay request is too large.", requestId }, 413, requestId);
  }

  let parsed: ReplayRequest | null = null;
  try {
    const text = await request.text();
    parsed = parseReplayRequest(text.trim() ? JSON.parse(text) as unknown : null);
  } catch {
    parsed = null;
  }
  if (!parsed) {
    return json<ApiError>({ ok: false, code: "BAD_REQUEST", message: "Replay request requires a valid ticker symbol and JSON body.", requestId }, 400, requestId);
  }

  const started = Date.now();
  const timespan = parsed.timespan ?? "minute";
  const multiplier = parsed.multiplier ?? 1;
  const historyBars = parsed.historyBars ?? 500;
  const warmupBars = parsed.warmupBars ?? scannerConfig.lookbackBars;
  const evaluationBars = parsed.evaluationBars ?? 12;
  const stepBars = parsed.stepBars ?? 1;

  try {
    const bars = await marketDataProvider.bars(parsed.symbol, { timespan, multiplier, lookbackBars: historyBars });
    const signals = replayCandles(parsed.symbol, bars, {
      warmupBars,
      evaluationBars,
      stepBars,
      minScore: parsed.minScore ?? Math.max(scannerConfig.minScore, 74),
      minGrade: parsed.minGrade ?? "B",
      states: parsed.states ?? ["READY", "BREAKING"],
      maxSignals: parsed.maxSignals ?? 100,
    });

    const byPattern: ReplayResponse["byPattern"] = {};
    for (const pattern of [...new Set(signals.map((signal) => signal.pattern))]) {
      byPattern[pattern] = summarizeReplay(signals.filter((signal) => signal.pattern === pattern));
    }

    const response: ReplayResponse = {
      ok: true,
      engine: "TRI6_ELITE",
      engineVersion: ENGINE_VERSION,
      generatedAt: Date.now(),
      provider: marketDataProvider.name,
      symbol: parsed.symbol,
      timeframe: timeframeLabel(timespan, multiplier),
      historyBars: bars.length,
      warmupBars,
      evaluationBars,
      stepBars,
      elapsedMs: Date.now() - started,
      signals,
      summary: summarizeReplay(signals),
      byPattern,
    };
    return json(response, 200, requestId);
  } catch (error) {
    return json<ApiError>({
      ok: false,
      code: "REPLAY_FAILED",
      message: "TRI6 historical validation could not complete.",
      detail: error instanceof Error ? error.message.replace(/apiKey=[^&\s]+/gi, "apiKey=REDACTED") : "Unknown validation error",
      requestId,
    }, 502, requestId);
  }
}
