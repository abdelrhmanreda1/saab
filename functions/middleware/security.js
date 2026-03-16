/**
 * Security Middleware for Firebase Functions
 * Includes DDoS protection, request validation, and security headers
 */

export const securityHeaders = (req, res, next) => {
  // Security headers (CSP removed - let Next.js handle it)
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // Don't set CSP here - Next.js will handle it via next.config.ts
  
  if (next) next();
};

export const validateRequest = (req, res, next) => {
  // Check for suspicious patterns
  const suspiciousPatterns = [
    /\.\./, // Path traversal
    /<script/i, // XSS attempts
    /union.*select/i, // SQL injection
    /eval\(/i, // Code injection
  ];

  const url = req.url || '';
  const body = JSON.stringify(req.body || {});

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url) || pattern.test(body)) {
      res.status(400).json({
        error: 'Invalid Request',
        message: 'Request contains suspicious content.',
      });
      return false;
    }
  }

  if (next) next();
  return true;
};

export const ddosProtection = (options = {}) => {
  const {
    maxRequestsPerMinute = 60,
    blockDuration = 60000, // 1 minute
  } = options;

  const requestCounts = new Map();
  const blockedIPs = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    // Check if IP is blocked
    const blockInfo = blockedIPs.get(ip);
    if (blockInfo && blockInfo > now) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Your IP has been temporarily blocked due to excessive requests.',
      });
      return false;
    }

    // Clean up old blocks
    if (blockInfo && blockInfo <= now) {
      blockedIPs.delete(ip);
    }

    // Track requests
    const record = requestCounts.get(ip);
    if (!record || record.resetTime < now) {
      requestCounts.set(ip, {
        count: 1,
        resetTime: now + 60000, // 1 minute window
      });
      return next ? next() : true;
    }

    record.count++;

    if (record.count > maxRequestsPerMinute) {
      // Block IP
      blockedIPs.set(ip, now + blockDuration);
      requestCounts.delete(ip);
      
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Your IP has been temporarily blocked due to excessive requests.',
      });
      return false;
    }

    return next ? next() : true;
  };
};

