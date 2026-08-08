import { timingSafeEqual } from "node:crypto";

interface Bucket {
  startedAt: number;
  count: number;
}

const buckets = new Map<string, Bucket>();
const WINDOW_MS = 60_000;

function limitPerMinute(): number {
  const raw = Number(process.env.SCANNER_MAX_REQUESTS_PER_MINUTE ?? 12);
  return Number.isFinite(raw) ? Math.max(1, Math.min(120, Math.floor(raw))) : 12;
}

function constantTimeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function isAuthorized(request: Request): boolean {
  const expected = process.env.SCANNER_ACCESS_TOKEN?.trim();
  if (!expected) return true;
  const supplied = request.headers.get("x-tri6-token")?.trim() ?? "";
  return constantTimeEqual(supplied, expected);
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function consumeScanAllowance(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();

  // Bound process-local memory under public traffic. Stale buckets carry no value
  // after the active rate window and can be discarded safely.
  if (buckets.size > 5_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (now - bucket.startedAt >= WINDOW_MS) buckets.delete(bucketKey);
    }
  }

  const current = buckets.get(key);
  const limit = limitPerMinute();

  if (!current || now - current.startedAt >= WINDOW_MS) {
    buckets.set(key, { startedAt: now, count: 1 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((WINDOW_MS - (now - current.startedAt)) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
