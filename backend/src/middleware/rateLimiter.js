/**
 * In-memory sliding-window rate limiter
 */

const requestCounts = new Map();

function rateLimiter(maxRequests = 500, windowMs = 15 * 60 * 1000) {
  return (req, res, next) => {
    // Exclude healthcheck or seed demo
    if (req.path === '/health') return next();

    const ip = req.ip || req.connection.remoteAddress || '127.0.0.1';
    const now = Date.now();

    const userRecord = requestCounts.get(ip) || { count: 0, resetTime: now + windowMs };

    if (now > userRecord.resetTime) {
      userRecord.count = 0;
      userRecord.resetTime = now + windowMs;
    }

    userRecord.count++;
    requestCounts.set(ip, userRecord);

    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - userRecord.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(userRecord.resetTime / 1000));

    if (userRecord.count > maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please try again later.'
        }
      });
    }

    next();
  };
}

module.exports = { rateLimiter };
