// Lightweight in-memory rate limiter (sliding window).
//
// NOTE: state lives in the serverless instance's memory, so it resets on cold
// start and isn't shared across instances. That makes it a best-effort throttle
// against flooding/brute-force — good enough to blunt a single abusive client or
// script — not a hard distributed guarantee. For strong limits, back this with
// Upstash/Redis later (same interface).

interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Hit>();

// Opportunistic cleanup so the map can't grow unbounded.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export interface RateResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

/**
 * Allow up to `limit` events per `windowMs` for a given key.
 * Returns ok=false once the limit is exceeded within the window.
 */
export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateResult {
  sweep(now);
  const hit = buckets.get(key);
  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }
  if (hit.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.ceil((hit.resetAt - now) / 1000) };
  }
  hit.count += 1;
  return { ok: true, remaining: limit - hit.count, retryAfterSec: 0 };
}

/** Best-effort client IP from standard proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}
