import { ApiResponse } from "../utils/api-response.js";

// Small per-process limiter for this single-instance demo. For multiple API
// instances, replace the in-memory store with a shared store such as Redis.
export const rateLimit = ({ windowMs, max, message }) => {
  const clients = new Map();
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of clients) {
      if (entry.resetAt <= now) clients.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  cleanup.unref?.();

  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || "unknown";
    let entry = clients.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      clients.set(key, entry);
    }

    entry.count += 1;
    res.setHeader("RateLimit-Limit", max);
    res.setHeader("RateLimit-Remaining", Math.max(0, max - entry.count));
    res.setHeader("RateLimit-Reset", Math.max(0, Math.ceil((entry.resetAt - now) / 1000)));
    if (entry.count > max) {
      res.setHeader("Retry-After", Math.max(1, Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json(new ApiResponse(429, {}, message));
    }
    return next();
  };
};
