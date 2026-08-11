import { describe, expect, it } from "vitest";
import { parseScanRequest } from "@/lib/validation";

describe("TRI6 scan request validation", () => {
  it("accepts professional filters and clamps unsafe values", () => {
    const parsed = parseScanRequest({ minScore: 140, minGrade: "A", direction: "BULLISH", states: ["READY", "READY", "junk"], patterns: ["FALLING_WEDGE", "junk"], maxResults: 500, lookbackBars: 10 });
    expect(parsed.minScore).toBe(100);
    expect(parsed.minGrade).toBe("A");
    expect(parsed.states).toEqual(["READY"]);
    expect(parsed.patterns).toEqual(["FALLING_WEDGE"]);
    expect(parsed.maxResults).toBe(100);
    expect(parsed.lookbackBars).toBe(60);
  });

  it("drops invalid enum values instead of trusting client input", () => {
    const parsed = parseScanRequest({ minGrade: "S", direction: "UP", states: ["MOON"], patterns: ["HEAD_AND_SHOULDERS"] });
    expect(parsed.minGrade).toBeUndefined();
    expect(parsed.direction).toBeUndefined();
    expect(parsed.states).toBeUndefined();
    expect(parsed.patterns).toBeUndefined();
  });
});
