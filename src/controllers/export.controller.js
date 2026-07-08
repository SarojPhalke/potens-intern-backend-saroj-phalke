const exportService = require('../services/export.service');
const logger = require('../config/logger');

/**
 * GET /export
 *
 * Flow:
 *   Read query params (actor, startDate, endDate)
 *     -> export.service validates filters and calls the model
 *     -> Return { success, count, filters, data }
 *
 * The controller stays thin: no SQL, no filter-validation logic here.
 */
async function exportLogs(req, res, next) {
  try {
    const { actor, startDate, endDate } = req.query;

    const { data, filters } = await exportService.exportLogs({
      actor,
      startDate,
      endDate,
    });

    // Business event logging
    logger.info(
      { filters, count: data.length },
      'Export completed'
    );

    return res.status(200).json({
      success: true,
      count: data.length,
      filters,
      data,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  exportLogs,
};