const express = require('express');

const router = express.Router();

const logController = require('../controllers/log.controller');
const apiKeyMiddleware = require('../middleware/apiKey.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');
const verifyController = require('../controllers/verify.controller');
/**
 * POST /log
 *
 * Route -> API Key Middleware -> Rate Limiter -> Controller
 *   -> Model (get latest log) -> Hash Service -> Model (insert log)
 *   -> Response
 */
router.post('/log', apiKeyMiddleware, rateLimiter, logController.createLog);

// --- Coming in later phases ---
 
// const exportController = require('../controllers/export.controller');
//
 router.get('/log/:id', apiKeyMiddleware,verifyController.getLogWithStatus);
// router.get('/verify', apiKeyMiddleware, rateLimiter, verifyController.verifyChain);
// router.get('/export', apiKeyMiddleware, rateLimiter, exportController.exportLogs);

module.exports = router;