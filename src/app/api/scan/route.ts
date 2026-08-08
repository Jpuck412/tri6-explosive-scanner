import { NextResponse } from "next/server";
import { marketDataProvider } from "@/lib/provider";
import { runScan } from "@/lib/engine/service";
import { clientKey, consumeScanAllowance, isAuthorized } from "@/lib/security/scanGuard";
import type { ApiError, ScanRequest } from "@/lib/types";
import { parseScanRequest } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    const body: ApiError = {
      ok: false,
      code: "UNAUTHORIZED",
      message: "TRI6 access token is missing or invalid.",
    };
    return NextResponse.json(body, { status: 401 });
  }

  const allowance = consumeScanAllowance(clientKey(request));
  if (!allowance.allowed) {
    const body: ApiError = {
      ok: false,
      code: "RATE_LIMITED",
      message: "Live scan rate limit reached.",
      detail: `Retry in about ${allowance.retryAfterSeconds} seconds.`,
    };
    return NextResponse.json(body, {
      status: 429,
      headers: { "Retry-After": String(allowance.retryAfterSeconds) },
    });
  }

  if (!marketDataProvider.configured()) {
    const body: ApiError = {
      ok: false,
      code: "PROVIDER_NOT_CONFIGURED",
      message: "A live market-data API key is required. No demo data is used.",
      detail: "Set POLYGON_API_KEY or MASSIVE_API_KEY in the server environment.",
    };
    return NextResponse.json(body, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 50_000) {
    const body: ApiError = { ok: false, code: "REQUEST_TOO_LARGE", message: "Scan request is too large." };
    return NextResponse.json(body, { status: 413 });
  }

  let input: ScanRequest = {};
  try {
    const text = await request.text();
    input = text.trim() ? parseScanRequest(JSON.parse(text) as unknown) : {};
  } catch {
    const body: ApiError = { ok: false, code: "BAD_REQUEST", message: "Scan request must be valid JSON." };
    return NextResponse.json(body, { status: 400 });
  }

  try {
    const result = await runScan(input);
    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (error) {
    const body: ApiError = {
      ok: false,
      code: "SCAN_FAILED",
      message: "The live scan could not complete.",
      detail: error instanceof Error ? error.message : "Unknown scanner error",
    };
    return NextResponse.json(body, { status: 502 });
  }
}
