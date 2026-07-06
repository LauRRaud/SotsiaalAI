const buckets = new Map();
const MAX_BUCKETS = 10_000;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;
let lastSweepAt = 0;

function sweep(now) {
  if (now - lastSweepAt < SWEEP_INTERVAL_MS && buckets.size < MAX_BUCKETS) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (!bucket || bucket.reset <= now) {
      buckets.delete(key);
    }
  }
  if (buckets.size <= MAX_BUCKETS) return;
  const overflow = buckets.size - MAX_BUCKETS;
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    removed += 1;
    if (removed >= overflow) break;
  }
}

export function consumeRateLimit(key, limit, windowMs) {
  const normalizedKey = String(key || "").trim();
  const normalizedLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : 1;
  const normalizedWindow = Number.isFinite(windowMs) ? Math.max(1000, Math.floor(windowMs)) : 60_000;

  const now = Date.now();
  sweep(now);

  const current = buckets.get(normalizedKey);
  const bucket = !current || current.reset <= now ? { count: 0, reset: now + normalizedWindow } : current;
  bucket.count += 1;
  buckets.set(normalizedKey, bucket);

  const allowed = bucket.count <= normalizedLimit;
  const retryAfterSec = allowed ? 0 : Math.max(1, Math.ceil((bucket.reset - now) / 1000));
  const remaining = Math.max(0, normalizedLimit - bucket.count);

  return {
    allowed,
    remaining,
    retryAfterSec,
    resetAt: bucket.reset
  };
}
