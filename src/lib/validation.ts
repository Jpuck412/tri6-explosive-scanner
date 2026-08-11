import type { Direction, PatternState, PatternType, QualityGrade, ScanRequest } from "@/lib/types";

const timespans = new Set(["minute", "hour", "day"] as const);
const directions = new Set(["ALL", "BULLISH", "BEARISH"] as const);
const states = new Set<PatternState>(["FORMING", "COMPRESSED", "READY", "BREAKING", "CONFIRMED"]);
const patterns = new Set<PatternType>(["ASCENDING_TRIANGLE", "DESCENDING_TRIANGLE", "BULLISH_SYMMETRICAL_TRIANGLE", "BEARISH_SYMMETRICAL_TRIANGLE", "FALLING_WEDGE", "RISING_WEDGE"]);
const grades = new Set<QualityGrade>(["A+", "A", "B", "C"]);

function finiteNumber(value: unknown, min: number, max: number): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.max(min, Math.min(max, value));
}

export function parseScanRequest(value: unknown): ScanRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const output: ScanRequest = {};
  if (Array.isArray(input.symbols)) {
    const symbols = input.symbols.filter((item): item is string => typeof item === "string").map((item) => item.trim().toUpperCase()).filter((item) => item.length > 0 && item.length <= 12).slice(0, 250);
    if (symbols.length) output.symbols = [...new Set(symbols)];
  }
  if (typeof input.timespan === "string" && timespans.has(input.timespan as "minute" | "hour" | "day")) output.timespan = input.timespan as "minute" | "hour" | "day";
  const multiplier = finiteNumber(input.multiplier, 1, 60); if (multiplier !== undefined) output.multiplier = Math.floor(multiplier);
  const lookbackBars = finiteNumber(input.lookbackBars, 60, 600); if (lookbackBars !== undefined) output.lookbackBars = Math.floor(lookbackBars);
  const minScore = finiteNumber(input.minScore, 0, 100); if (minScore !== undefined) output.minScore = minScore;
  if (typeof input.minGrade === "string" && grades.has(input.minGrade as QualityGrade)) output.minGrade = input.minGrade as QualityGrade;
  if (typeof input.direction === "string" && directions.has(input.direction as "ALL" | Direction)) output.direction = input.direction as "ALL" | Direction;
  if (Array.isArray(input.states)) {
    const parsed = input.states.filter((item): item is PatternState => typeof item === "string" && states.has(item as PatternState));
    if (parsed.length) output.states = [...new Set(parsed)];
  }
  if (Array.isArray(input.patterns)) {
    const parsed = input.patterns.filter((item): item is PatternType => typeof item === "string" && patterns.has(item as PatternType));
    if (parsed.length) output.patterns = [...new Set(parsed)];
  }
  const maxResults = finiteNumber(input.maxResults, 1, 100); if (maxResults !== undefined) output.maxResults = Math.floor(maxResults);
  return output;
}
