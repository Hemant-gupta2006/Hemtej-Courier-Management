type RateLimitInfo = { count: number; lastReset: number };
const rateLimits = new Map<string, RateLimitInfo>();

export function checkRateLimit(userId: string, maxRequests: number = 10, windowMs: number = 10000): boolean {
  const now = Date.now();
  let info = rateLimits.get(userId);

  if (!info || now - info.lastReset > windowMs) {
    info = { count: 1, lastReset: now };
  } else {
    info.count++;
  }

  rateLimits.set(userId, info);
  return info.count <= maxRequests;
}
