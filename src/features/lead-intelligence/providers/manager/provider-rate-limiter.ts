type Bucket = {
  timestamps: number[];
};

const buckets = new Map<string, Bucket>();

export function isRateLimited(providerId: string, limitPerMinute: number): boolean {
  if (limitPerMinute <= 0) return false;

  const now = Date.now();
  const windowMs = 60_000;
  const bucket = buckets.get(providerId) ?? { timestamps: [] };

  bucket.timestamps = bucket.timestamps.filter((timestamp) => now - timestamp < windowMs);
  buckets.set(providerId, bucket);

  if (bucket.timestamps.length >= limitPerMinute) {
    return true;
  }

  bucket.timestamps.push(now);
  return false;
}
