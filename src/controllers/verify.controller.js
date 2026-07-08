const logModel = require('../models/log.model');
const { verifyLogHash } = require('../services/verify.service');
const logger = require('../config/logger');
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

module.exports = {
  getLogWithStatus,
};