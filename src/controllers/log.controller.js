const logModel = require('../models/log.model');
const { generateHash } = require('../services/hash.service');
const logger = require('../config/logger');
const merkleService = require('../services/merkle.service');
const merkleModel = require('../models/merkle.model');
/**
 * POST /log
 *
 * Flow:
 *   1. Validate request body.
 *   2. Ask the model for the latest log entry -> previous_hash.
 *   3. Ask the hash service to generate current_hash from
 *      { actor, action, payload, previous_hash }.
 *   4. Ask the model to insert the new row.
 *   5. Check whether this insert just completed a merkle batch
 *      (every 10 logs); if so, compute and store the batch hash.
 *   6. Return the created log entry.
 *
 * The controller coordinates; it does not compute hashes itself and
 * does not write SQL itself.
 */
async function createLog(req, res, next) {
  try {
    const { actor, action, payload } = req.body || {};

    if (!actor || typeof actor !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'actor is required and must be a string',
      });
    }

    if (!action || typeof action !== 'string') {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'action is required and must be a string',
      });
    }

    if (
      payload === undefined ||
      payload === null ||
      typeof payload !== 'object' ||
      Array.isArray(payload)
    ) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'payload is required and must be a JSON object',
      });
    }

    // Step 1: get the previous hash from the model
    const latestLog = await logModel.getLatestLog();
    const previous_hash = latestLog ? latestLog.current_hash : null;

    // Step 2: generate the new hash via the hash service (pure, no DB)
    const current_hash = generateHash({ actor, action, payload, previous_hash });

    // Step 3: persist the new log entry via the model
    const newLog = await logModel.createLog({
      actor,
      action,
      payload,
      previous_hash,
      current_hash,
    });

    // Business event logging
    logger.info(
        { id: newLog.id, actor, action },
        'Created audit log entry'
      );


         // Step 4: merkle batching — does this insert complete a batch of 10?
    let batch = null;
    try {
      const batchRange = merkleService.getBatchRangeIfComplete(Number(newLog.id));
 
      if (batchRange) {
        const { startId, endId } = batchRange;
        const rangeRows = await logModel.getHashesInRange(startId, endId);
        const hashes = rangeRows.map((row) => row.current_hash);
        const batch_hash = merkleService.computeBatchHash(hashes);
 
        batch = await merkleModel.createBatch({
          start_log_id: startId,
          end_log_id: endId,
          batch_hash,
        });
 
        // Business event logging
        logger.info(
          { start_log_id: startId, end_log_id: endId, batch_hash },
          'Merkle batch created'
        );
      }
    } catch (batchErr) {
      // A batching failure must NOT fail the log write itself — the
      // core hash chain already succeeded and is independently valid.
      // But it's an integrity feature, so log it loudly.
      logger.error(
        { err: batchErr, logId: newLog.id },
        'Failed to create merkle batch'
      );
    }

    return res.status(201).json({ data: newLog , batch });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createLog,
};