import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ENGINE_VERSION } from "@/lib/config";
import { runScan } from "@/lib/engine/service";
import { marketDataProvider } from "@/lib/provider";
import { clientKey, consumeScanAllowance, isAuthorized } from "@/lib/security/scanGuard";
import type { ApiError, ScanRequest, ScanResponse } from "@/lib/types";
import { parseScanRequest } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function response<T extends ApiError | ScanResponse>(body: T, status = 200, requestId = randomUUID(), extraHeaders?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0", "X-Request-Id": requestId, "X-TRI6-Engine": ENGINE_VERSION, ...extraHeaders },
  });
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  if (!isAuthorized(request)) {
    return response<ApiError>({ ok: false, code: "UNAUTHORIZED", message: "TRI6 access token is missing or invalid.", requestId }, 401, requestId);
  }
  const allowance = consumeScanAllowance(clientKey(request));
  if (!allowance.allowed) {
    return response<ApiError>({ ok: false, code: "RATE_LIMITED", message: "Live scan rate limit reached.", detail: `Retry in about ${allowance.retryAfterSeconds} seconds.`, requestId }, 429, requestId, { "Retry-After": String(allowance.retryAfterSeconds) });
  }
  if (!marketDataProvider.configured()) {
    return response<ApiError>({ ok: false, code: "PROVIDER_NOT_CONFIGURED", message: "A live market-data API key is required. TRI6 never substitutes demo results.", detail: "Set POLYGON_API_KEY or MASSIVE_API_KEY in the server environment.", requestId }, 503, requestId);
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 50_000) {
    return response<ApiError>({ ok: false, code: "REQUEST_TOO_LARGE", message: "Scan request is too large.", requestId }, 413, requestId);
  }
  let input: ScanRequest = {};
  try {
    const text = await request.text();
    input = text.trim() ? parseScanRequest(JSON.parse(text) as unknown) : {};
  } catch {
    return response<ApiError>({ ok: false, code: "BAD_REQUEST", message: "Scan request must be valid JSON.", requestId }, 400, requestId);
  }
  try {
    const result = await runScan(input);
    return response(result, 200, requestId);
  } catch (error) {
    return response<ApiError>({ ok: false, code: "SCAN_FAILED", message: "The live scan could not complete.", detail: error instanceof Error ? error.message.replace(/apiKey=[^&\s]+/gi, "apiKey=REDACTED") : "Unknown scanner error", requestId }, 502, requestId);
  }
}
