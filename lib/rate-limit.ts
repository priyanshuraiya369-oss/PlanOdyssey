/** Small in-memory rate limiter. Good enough to stop abuse of AI routes on a single instance. */
const buckets = new Map<string, { count: number; reset: number }>();

export function clientKey(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** Returns true while the caller is under the limit. */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now) {
    if (buckets.size > 5000) for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    buckets.set(key, { count: 1, reset: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}
