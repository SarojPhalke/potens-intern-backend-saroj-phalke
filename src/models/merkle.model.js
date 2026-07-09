const { pool } = require('../config/db');

/**
 * SQL access only for merkle_batches. No hashing, no Express,
 * no batching decisions belong here — see merkle.service.js for that.
 */

/**
 * Insert a new completed batch.
 *
 * @param {Object} params
 * @param {number} params.start_log_id
 * @param {number} params.end_log_id
 * @param {string} params.batch_hash
 * @returns {Promise<Object>} the newly created batch row.
 */
async function createBatch({ start_log_id, end_log_id, batch_hash }) {
  const { rows } = await pool.query(
    `INSERT INTO merkle_batches (start_log_id, end_log_id, batch_hash)
     VALUES ($1, $2, $3)
     RETURNING id, start_log_id, end_log_id, batch_hash, created_at`,
    [start_log_id, end_log_id, batch_hash]
  );
  return rows[0];
}

/**
 * Fetch all batches, ordered by their log range ascending.
 *
 * @returns {Promise<Object[]>}
 */
async function getAllBatches() {
  const { rows } = await pool.query(
    `SELECT id, start_log_id, end_log_id, batch_hash, created_at
     FROM merkle_batches
     ORDER BY start_log_id ASC`
  );
  return rows;
}

/**
 * Find the batch that contains a given log id, if any.
 *
 * @param {number} logId
 * @returns {Promise<Object|null>}
 */
async function getBatchByLogId(logId) {
  const { rows } = await pool.query(
    `SELECT id, start_log_id, end_log_id, batch_hash, created_at
     FROM merkle_batches
     WHERE start_log_id <= $1 AND end_log_id >= $1`,
    [logId]
  );
  return rows[0] || null;
}

module.exports = {
  createBatch,
  getAllBatches,
  getBatchByLogId,
};