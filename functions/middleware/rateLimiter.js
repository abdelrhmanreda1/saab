/**
 * Rate Limiting Middleware for Firebase Functions
 * Prevents abuse by limiting requests per IP/user
 */

const rateLimitMap = new Map();

export const rateLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 500, // max requests per window (increased from 100 to 500)
    keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    skipSuccessfulRequests = false,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    skipFailedRequests = false,
  } = options;

  return async (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    // Clean up old entries
    if (rateLimitMap.size > 10000) {
      const cutoff = now - windowMs;
      for (const [k, v] of rateLimitMap.entries()) {
        if (v.resetTime < cutoff) {
          rateLimitMap.delete(k);
        }
      }
    }

    const record = rateLimitMap.get(key);
    
    if (!record || record.resetTime < now) {
      // Create new record
      rateLimitMap.set(key, {
        count: 1,
        resetTime: now + windowMs,
      });
      return next ? next() : true;
    }

    record.count++;

    if (record.count > maxRequests) {
      const retryAfter = Math.ceil((record.resetTime - now) / 1000);
      res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Please try again after ${retryAfter} seconds.`,
        retryAfter,
      });
      return false;
    }

    return next ? next() : true;
  };
};

export const createRateLimiter = (options) => rateLimiter(options);

