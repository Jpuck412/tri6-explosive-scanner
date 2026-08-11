import { describe, expect, it } from "vitest";
import { gradeScore, weightedScore } from "@/lib/engine/scan";
import type { PatternEvidence } from "@/lib/types";

const strong: PatternEvidence = {
  upperSlopePctPerBar: -0.04, lowerSlopePctPerBar: 0.05, upperR2: 0.91, lowerR2: 0.89, upperTouches: 4, lowerTouches: 4,
  upperInlierPct: 100, lowerInlierPct: 100, compressionPct: 72, rangeCompressionPct: 58, wickContainmentPct: 90, bodyContainmentPct: 96,
  violationPct: 1, touchSpacingScore: 88, alternationScore: 100, apexProgressPct: 79, apexBarsAway: 12, breakoutDistancePct: 0.2,
  invalidationDistancePct: 4, currentWidthPct: 2, formationBars: 55, fitScore: 94, touchScore: 92, convergenceScore: 99,
  compressionScore: 91, containmentScore: 95, structureScore: 94, proximityScore: 94,
};

describe("TRI6 elite scoring", () => {
  it("keeps a strong structure in professional grade territory", () => { const score = weightedScore(strong); expect(score).toBeGreaterThan(90); expect(gradeScore(score)).toBe("A+"); });
  it("uses deterministic grade boundaries", () => { expect(gradeScore(90)).toBe("A+"); expect(gradeScore(82)).toBe("A"); expect(gradeScore(74)).toBe("B"); expect(gradeScore(73.9)).toBe("C"); });
});
