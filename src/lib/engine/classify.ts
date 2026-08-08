import { scannerConfig } from "@/lib/config";
import type { Direction, PatternType } from "@/lib/types";

export interface ShapeInput {
  upperSlopePctPerBar: number;
  lowerSlopePctPerBar: number;
  bullishBias?: boolean;
}

export interface ShapeClassification {
  pattern: PatternType;
  direction: Direction;
}

export function classifyShape(input: ShapeInput): ShapeClassification | null {
  const { upperSlopePctPerBar: u, lowerSlopePctPerBar: l } = input;
  const horizontal = scannerConfig.horizontalSlopePctPerBar;
  const minSlope = scannerConfig.minSlopePctPerBar;
  const upperFlat = Math.abs(u) <= horizontal;
  const lowerFlat = Math.abs(l) <= horizontal;
  const upperDown = u <= -minSlope;
  const upperUp = u >= minSlope;
  const lowerDown = l <= -minSlope;
  const lowerUp = l >= minSlope;

  // Same-direction sloping boundaries are wedges, so classify them before
  // flat-line triangle tolerances can absorb a shallow wedge boundary.
  if (upperDown && lowerDown && u < l) {
    return { pattern: "FALLING_WEDGE", direction: "BULLISH" };
  }

  if (upperUp && lowerUp && l > u) {
    return { pattern: "RISING_WEDGE", direction: "BEARISH" };
  }

  if (upperDown && lowerUp && l > u) {
    return input.bullishBias === false
      ? { pattern: "BEARISH_SYMMETRICAL_TRIANGLE", direction: "BEARISH" }
      : { pattern: "BULLISH_SYMMETRICAL_TRIANGLE", direction: "BULLISH" };
  }

  if (upperFlat && lowerUp && l > u) {
    return { pattern: "ASCENDING_TRIANGLE", direction: "BULLISH" };
  }

  if (lowerFlat && upperDown && l > u) {
    return { pattern: "DESCENDING_TRIANGLE", direction: "BEARISH" };
  }

  return null;
}
