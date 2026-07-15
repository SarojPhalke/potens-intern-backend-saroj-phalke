const logModel = require('../models/log.model');

const logger = require('../config/logger');
const { verifyLogHash, verifyChain ,verifyChainWithMerkle } = require('../services/verify.service');
/**
 * GET /log/:id
 *
 * Flow:
 *   Receive ID
 *     -> Fetch log from DB (model)
 *     -> Does log exist? No -> 404
 *     -> Yes -> generate expected hash & compare (verify.service)
 *     -> Return log + verification status
 */
async function getLogWithStatus(req, res, next) {
  try {

    const { id } = req.params;

    if (!id || Number.isNaN(Number(id))) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'id must be a valid number',
      });
    }

    const log = await logModel.getLogById(id);

    if (!log) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Log with id ${id} not found`,
      });
    }

    const { is_valid, expected_hash, stored_hash } = verifyLogHash(log);

    // Business event logging
       logger.info(
      { id, result: is_valid ? 'PASS' : 'FAIL' },
      'Single-entry verification completed'
    );

    return res.status(200).json({
      data: log,
      verification: {
        is_valid,
        expected_hash,
        stored_hash,
      },
    });
  } catch (err) {
    return next(err);
  }
}


/**
 * GET /verify
 *
 * Flow:
 *   Fetch ALL logs (model, ascending order)
 *     -> verify.service.verifyChain() loops through them
 *     -> Return PASS/FAIL result
 *
 * The controller stays thin: fetch, delegate, respond. All the
 * looping/hash/chain-check logic lives in verify.service.js.
 */
async function verifyChainHandler(req, res, next) {
    try {
      const logs = await logModel.getAllLogsOrdered();
      const result = verifyChain(logs);
   
      if (result.status === 'PASS') {
        logger.info(
          { result: result.status, entriesVerified: result.entriesVerified },
          'Chain verification completed'
        );
      } else {
        // A broken chain means tampering was detected — log at error level
        // so it surfaces in alerting/monitoring, not buried in routine info logs.
        logger.error(
          {
            result: result.status,
            entriesVerified: result.entriesVerified,
            brokenEntryId: result.brokenEntryId,
            reason: result.reason,
          },
          'Chain verification FAILED — tampering detected'
        );
      }

      return res.status(200).json(result);
    } catch (err) {
      return next(err);
    }
  }

  /**
 * GET /verify/fast
 *
 * Same PASS/FAIL contract as GET /verify, but uses merkle batches to
 * skip per-log verification for any batch whose stored batch_hash
 * still matches a fresh recomputation — only falling back to a full
 * per-entry scan for a batch that actually fails. See
 * verify.service.verifyChainWithMerkle() for the tiered algorithm.
 *
 * CAVEAT: only covers logs that have been rolled into a completed
 * batch. Logs since the last completed batch (a partial, not-yet-10
 * batch) are not included — this endpoint trades total coverage for
 * speed. Use GET /verify for a full guarantee including the tail.
 */
async function verifyChainFastHandler(req, res, next) {
  try {
    const batches = await merkleModel.getAllBatches();
    const result = await verifyChainWithMerkle(batches, logModel.getLogsInRange);
 
    // Business event logging
    if (result.status === 'PASS') {
      logger.info(
        {
          result: result.status,
          entriesVerified: result.entriesVerified,
          batchesVerified: result.batchesVerified,
          merkleRoot: result.merkleRoot,
        },
        'Fast (merkle) chain verification completed'
      );
    } else {
      logger.error(
        {
          result: result.status,
          entriesVerified: result.entriesVerified,
          batchesVerified: result.batchesVerified,
          merkleRoot: result.merkleRoot,
          brokenEntryId: result.brokenEntryId,
          brokenBatchId: result.brokenBatchId,
          reason: result.reason,
        },
        'Fast (merkle) chain verification FAILED — tampering detected'
      );
    }
 
    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
}
   
module.exports = {
  getLogWithStatus,
  verifyChain: verifyChainHandler,
  verifyChainFast: verifyChainFastHandler,
};