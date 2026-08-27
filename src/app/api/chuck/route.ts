import { NextRequest, NextResponse } from "next/server";
import { rankChuck, type ChuckInput } from "@/lib/chuck-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { candidates?: ChuckInput[] };
    if (!Array.isArray(body.candidates)) {
      return NextResponse.json({ error: "candidates[] is required" }, { status: 400 });
    }
    return NextResponse.json({
      engine: "CHUCK",
      generatedAt: new Date().toISOString(),
      count: body.candidates.length,
      results: rankChuck(body.candidates),
    });
  } catch {
    return NextResponse.json({ error: "invalid JSON payload" }, { status: 400 });
  }
}

export async function GET() {
  return NextResponse.json({
    engine: "CHUCK",
    status: "online",
    philosophy: "Evidence > prediction. No proof = no trade.",
    endpoint: "POST /api/chuck",
  });
}
