import { NextResponse } from "next/server";
import { marketDataProvider } from "@/lib/provider";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "TRI6",
    providerConfigured: marketDataProvider.configured(),
    timestamp: Date.now(),
  }, { headers: { "Cache-Control": "no-store" } });
}
