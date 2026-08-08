import { describe, expect, it } from "vitest";
import { classifyShape } from "@/lib/engine/classify";

const classify = (upper: number, lower: number, bullishBias = true) => classifyShape({
  upperSlopePctPerBar: upper,
  lowerSlopePctPerBar: lower,
  bullishBias,
});

describe("TRI6 shape classifier", () => {
  it("classifies ascending triangles", () => {
    expect(classify(0.001, 0.08)?.pattern).toBe("ASCENDING_TRIANGLE");
  });

  it("classifies descending triangles", () => {
    expect(classify(-0.08, 0.001)?.pattern).toBe("DESCENDING_TRIANGLE");
  });

  it("splits symmetrical geometry by directional bias", () => {
    expect(classify(-0.07, 0.06, true)?.pattern).toBe("BULLISH_SYMMETRICAL_TRIANGLE");
    expect(classify(-0.07, 0.06, false)?.pattern).toBe("BEARISH_SYMMETRICAL_TRIANGLE");
  });

  it("classifies falling wedges", () => {
    expect(classify(-0.09, -0.035)?.pattern).toBe("FALLING_WEDGE");
  });

  it("classifies rising wedges", () => {
    expect(classify(0.03, 0.085)?.pattern).toBe("RISING_WEDGE");
  });

  it("rejects non-converging channels", () => {
    expect(classify(0.08, 0.02)).toBeNull();
  });
});
