import { describe, expect, it } from "vitest";
import { analyzeWithChuck } from "../src/lib/chuck-engine";

describe("CHUCK engine", () => {
  it("rewards 9:05 validation and strong control", () => {
    const r = analyzeWithChuck({
      symbol:"TEST", price:1.2, gainPct:120, volume:20_000_000,
      relativeVolume:20, volumeAcceleration:2, speedScore:82,
      spreadPct:0.4, buyerControl:82, supportStrength:80,
      riskDefined:true, oneCandleConfirmed:true, catalystScore:90,
      dilutionRisk:20, p905:1, open930:1.01, high935:1.12, close940:1.09,
    });
    expect(r.verdict).toBe("PERMISSION");
    expect(r.reclaimStrength).toBeGreaterThanOrEqual(100);
  });

  it("blocks weak buyer control even with a catalyst", () => {
    const r = analyzeWithChuck({
      symbol:"FAIL", price:.6, gainPct:80, volume:50_000_000,
      relativeVolume:30, volumeAcceleration:2, speedScore:80,
      spreadPct:0.5, buyerControl:30, supportStrength:35,
      riskDefined:false, catalystScore:95, dilutionRisk:10,
      p905:.7, open930:.64, high935:.65, close940:.60,
    });
    expect(r.verdict).not.toBe("PERMISSION");
    expect(r.failures.length).toBeGreaterThan(0);
  });
});
