import type { Direction, PatternState, ScanRequest } from "@/lib/types";

const timespans = new Set(["minute", "hour", "day"] as const);
const directions = new Set(["ALL", "BULLISH", "BEARISH"] as const);
const states = new Set<PatternState>(["FORMING", "COMPRESSED", "READY", "BREAKING", "CONFIRMED"]);

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

export function parseScanRequest(value: unknown): ScanRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: ScanRequest = {};

  if (Array.isArray(input.symbols)) {
    const symbols = input.symbols
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().toUpperCase())
      .filter((item) => item.length > 0 && item.length <= 12)
      .slice(0, 250);
    if (symbols.length) output.symbols = symbols;
  }

  if (typeof input.timespan === "string" && timespans.has(input.timespan as "minute" | "hour" | "day")) {
    output.timespan = input.timespan as "minute" | "hour" | "day";
  }

  const multiplier = finiteNumber(input.multiplier, 1, 60);
  if (multiplier !== undefined) output.multiplier = Math.floor(multiplier);

  const lookbackBars = finiteNumber(input.lookbackBars, 50, 600);
  if (lookbackBars !== undefined) output.lookbackBars = Math.floor(lookbackBars);

  const minScore = finiteNumber(input.minScore, 0, 100);
  if (minScore !== undefined) output.minScore = minScore;

  if (typeof input.direction === "string" && directions.has(input.direction as "ALL" | Direction)) {
    output.direction = input.direction as "ALL" | Direction;
  }

  if (Array.isArray(input.states)) {
    const parsedStates = input.states.filter((item): item is PatternState => typeof item === "string" && states.has(item as PatternState));
    if (parsedStates.length) output.states = [...new Set(parsedStates)];
  }

  const maxResults = finiteNumber(input.maxResults, 1, 100);
  if (maxResults !== undefined) output.maxResults = Math.floor(maxResults);

  return output;
}
