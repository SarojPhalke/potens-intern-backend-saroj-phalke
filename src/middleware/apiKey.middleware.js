/**
 * API Key middleware.
 *
 * Responsibility: AUTHENTICATION ONLY.
 * It checks that the request carries a valid API key. It does not
 * rate-limit, log, or touch the database.
 *
 * Expects the key to be sent via the `x-api-key` request header:
 *   x-api-key: <your-api-key>
 */
const logger = require('../config/logger');
function apiKeyMiddleware(req, res, next) {
    const providedKey = req.header('x-api-key');
    const expectedKey = process.env.API_KEY;
  
    if (!expectedKey) {
      // Fail closed: if the server itself has no key configured, refuse
      // all requests rather than silently allowing everything through.
      logger.error('API_KEY is not configured on the server');
      return res.status(500).json({
        error: 'Server Misconfiguration',
        message: 'API_KEY is not configured on the server',
      });
    }
  
    if (!providedKey) {
        logger.warn(
            { ip: req.ip, path: req.originalUrl },
            'Unauthorized request: missing API key'
          );
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing API key. Send it via the x-api-key header.',
      });
    }
  
    if (providedKey !== expectedKey) {

        logger.warn(
            { ip: req.ip, path: req.originalUrl },
            'Invalid API key received'
          );
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid API key.',
      });
    }
  
    return next();
  }
  
  module.exports = apiKeyMiddleware;