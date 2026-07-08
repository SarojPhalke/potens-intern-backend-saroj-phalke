const rateLimit = require('express-rate-limit');
const logger = require('../config/logger');
/**
 * Rate limiter middleware.
 *
 * Responsibility: REQUEST LIMITING ONLY.
 * It does not authenticate, log, or touch the database.
 *
 * Allows 100 requests per IP per 15-minute window. Adjust `windowMs`
 * and `max` as needed for your traffic profile.
 *
 * Requires: npm install express-rate-limit
 */
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // return rate limit info in RateLimit-* headers
  legacyHeaders: false, // disable the deprecated X-RateLimit-* headers

  handler: (req, res, next, options) => {
    logger.warn(
      { ip: req.ip, path: req.originalUrl },
      'Rate limit exceeded'
    );
    res.status(options.statusCode).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
  },
});

module.exports = rateLimiter;