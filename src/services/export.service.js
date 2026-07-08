const logModel = require('../models/log.model');

/**
 * Basic date validity check. Accepts anything Date() can parse
 * (e.g. '2026-07-01', full ISO timestamps). Empty/undefined is
 * treated as valid since the field is optional.
 *
 * @param {string|undefined} value
 * @returns {boolean}
 */
function isValidDate(value) {
  if (!value) return true;
  return !Number.isNaN(new Date(value).getTime());
}

/**
 * Build a validation error with a statusCode, so error.middleware.js
 * can map it straight to a 400 response.
 */
function validationError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  err.name = 'Validation Error';
  return err;
}

/**
 * Validate and normalize export filters, then ask the model for
 * matching logs.
 *
 * Flow: validate filters -> prepare search criteria -> call model.
 * No SQL and no Express here — this file only knows about filter
 * rules, not how they're queried or how they arrived over HTTP.
 *
 * @param {Object} rawFilters
 * @param {string} [rawFilters.actor]
 * @param {string} [rawFilters.startDate]
 * @param {string} [rawFilters.endDate]
 * @returns {Promise<{ data: Object[], filters: Object }>}
 * @throws {Error} with .statusCode = 400 if filters are invalid.
 */
async function exportLogs({ actor, startDate, endDate } = {}) {
  if (!isValidDate(startDate)) {
    throw validationError('startDate must be a valid date, e.g. 2026-07-01');
  }

  if (!isValidDate(endDate)) {
    throw validationError('endDate must be a valid date, e.g. 2026-07-31');
  }

  if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
    throw validationError('startDate must not be after endDate');
  }

  const filters = {
    actor: actor || null,
    startDate: startDate || null,
    endDate: endDate || null,
  };

  const data = await logModel.getFilteredLogs(filters);

  return { data, filters };
}

module.exports = {
  exportLogs,
};