/**
 * Fixed-window in-memory rate limiter. No database needed.
 * Note: on serverless each instance keeps its own counters, so this is best-effort
 * protection. For hard guarantees add Vercel Firewall rate limiting or Upstash Redis.
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { count: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.count++;
  return { ok: b.count <= limit, retryAfter: Math.max(1, Math.ceil((b.reset - now) / 1000)) };
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return xff || req.headers.get("x-real-ip") || "unknown";
}

export function _resetForTests() { buckets.clear(); }
