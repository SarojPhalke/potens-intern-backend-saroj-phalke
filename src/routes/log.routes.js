const express = require('express');

const router = express.Router();

const logController = require('../controllers/log.controller');
const apiKeyMiddleware = require('../middleware/apiKey.middleware');
const rateLimiter = require('../middleware/rateLimiter.middleware');
const verifyController = require('../controllers/verify.controller');
const exportController = require('../controllers/export.controller');
/**
 * POST /log
 *
 * Route -> API Key Middleware -> Rate Limiter -> Controller
 *   -> Model (get latest log) -> Hash Service -> Model (insert log)
 *   -> Response
 */
router.post('/log', apiKeyMiddleware, rateLimiter, logController.createLog);

 router.get('/log/:id', apiKeyMiddleware,verifyController.getLogWithStatus);
 router.get('/verify', apiKeyMiddleware, verifyController.verifyChain);

 /**
 * GET /verify/fast
 *
 * Route -> API Key Middleware -> Rate Limiter -> Controller
 *   -> Model (get all merkle batches) -> Verify Service
 *      (recompute batch hashes; only fall back to per-log scan for a
 *      failing batch) -> Response
 *
 * Same PASS/FAIL response shape as GET /verify, plus batchesVerified
 * and merkleRoot. Does not cover logs in a not-yet-completed batch —
 * use GET /verify for full coverage.
 */
router.get('/verify/fast', apiKeyMiddleware, rateLimiter, verifyController.verifyChainFast);
 router.get('/export', apiKeyMiddleware, exportController.exportLogs);

module.exports = router;