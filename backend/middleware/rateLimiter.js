/**
 * Custom in-memory rate limiter middleware.
 * Zero external dependencies.
 *
 * @param {object} options
 * @param {number} options.windowMs - Time frame in milliseconds
 * @param {number} options.max - Maximum number of requests allowed in windowMs
 * @param {string} options.message - Error message returned on block
 */
export function rateLimiter({ windowMs, max, message }) {
  // Isolated storage for this specific rate limiter instance
  const ipRequests = new Map();

  // Periodically clean up memory for expired IPs to prevent memory leaks
  setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of ipRequests.entries()) {
      const active = timestamps.filter((time) => now - time < windowMs);
      if (active.length === 0) {
        ipRequests.delete(ip);
      } else if (active.length !== timestamps.length) {
        ipRequests.set(ip, active);
      }
    }
  }, 10 * 60 * 1000); // Run cleanup every 10 minutes

  return (req, res, next) => {
    // Get IP address safely, taking proxies (Cloudflare, Nginx) into consideration
    const ip =
      req.headers['cf-connecting-ip'] ||
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.ip ||
      req.socket.remoteAddress;

    const now = Date.now();

    if (!ipRequests.has(ip)) {
      ipRequests.set(ip, []);
    }

    let timestamps = ipRequests.get(ip);

    // Filter out timestamps older than the window
    timestamps = timestamps.filter((time) => now - time < windowMs);

    if (timestamps.length >= max) {
      return res.status(429).json({
        success: false,
        message: message || 'Too many requests from this IP. Please try again later.',
      });
    }

    timestamps.push(now);
    ipRequests.set(ip, timestamps);
    next();
  };
}
