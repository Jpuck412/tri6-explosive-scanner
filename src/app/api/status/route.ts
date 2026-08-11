import { NextResponse } from "next/server";
import { ENGINE_VERSION, scannerConfig } from "@/lib/config";
import { marketDataProvider } from "@/lib/provider";
import type { EngineStatus, PatternType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patterns: PatternType[] = [
  "ASCENDING_TRIANGLE",
  "DESCENDING_TRIANGLE",
  "BULLISH_SYMMETRICAL_TRIANGLE",
  "BEARISH_SYMMETRICAL_TRIANGLE",
  "FALLING_WEDGE",
  "RISING_WEDGE",
];

export async function GET() {
  const body: EngineStatus = {
    ok: true,
    engine: "TRI6_ELITE",
    version: ENGINE_VERSION,
    providerConfigured: marketDataProvider.configured(),
    provider: marketDataProvider.name,
    liveDataOnly: true,
    scoreUsesOnlyGeometry: true,
    patterns,
    gates: {
      minScore: scannerConfig.minScore,
      minLineR2: scannerConfig.minLineR2,
      minBodyContainmentPct: scannerConfig.minBodyContainmentPct,
      minWickContainmentPct: scannerConfig.minWickContainmentPct,
      minTouchSpacingScore: scannerConfig.minTouchSpacingScore,
      minAlternationScore: scannerConfig.minAlternationScore,
      minCompressionPct: scannerConfig.minCompressionPct,
      minFormationBars: scannerConfig.minFormationBars,
    },
  };

  return NextResponse.json(body, {
    headers: { "Cache-Control": "no-store, max-age=0", "X-TRI6-Engine": ENGINE_VERSION },
  });
}
