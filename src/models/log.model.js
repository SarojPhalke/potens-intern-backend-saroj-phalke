const { pool } = require('../config/db');

/**
 * NOTE ON DB INTERFACE:
 * This model assumes `src/config/db.js` exports a `pool` object with a
 * `.query(text, params)` method that returns `{ rows }` — the standard
 * `pg` (node-postgres) Pool interface. If your db.js exports something
 * different (e.g. a raw client, or a wrapped `query` function), adjust
 * the import/usage accordingly.
 *
 * This file contains ONLY SQL access. No hashing, no Express req/res,
 * no verification logic belongs here.
 */

/**
 * Fetch the most recently created log entry (by id, which is
 * monotonically increasing via BIGSERIAL, so it reflects insertion order).
 *
 * Used by the log controller/service to determine `previous_hash`
 * before generating the next hash.
 *
 * @returns {Promise<Object|null>} the latest log row, or null if the table is empty.
 */
async function getLatestLog() {
  const { rows } = await pool.query(
    `SELECT id, actor, action, payload, previous_hash, current_hash, created_at
     FROM logs
     ORDER BY id DESC
     LIMIT 1`
  );
  return rows[0] || null;
}

/**
 * Insert a new log entry.
 *
 * All hash computation must happen BEFORE calling this function —
 * this function only persists the values it's given.
 *
 * @param {Object} params
 * @param {string} params.actor
 * @param {string} params.action
 * @param {Object} params.payload - will be stored as JSONB
 * @param {string|null} params.previous_hash
 * @param {string} params.current_hash
 * @returns {Promise<Object>} the newly created log row.
 */
async function createLog({ actor, action, payload, previous_hash, current_hash }) {
  const { rows } = await pool.query(
    `INSERT INTO logs (actor, action, payload, previous_hash, current_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, actor, action, payload, previous_hash, current_hash, created_at`,
    [actor, action, payload, previous_hash || null, current_hash]
  );
  return rows[0];
}

/**
 * Fetch a single log entry by its id.
 *
 * @param {number|string} id
 * @returns {Promise<Object|null>} the log row, or null if not found.
 */
async function getLogById(id) {
  const { rows } = await pool.query(
    `SELECT id, actor, action, payload, previous_hash, current_hash, created_at
     FROM logs
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

/**
 * Fetch log entries, oldest first (ascending by id), with optional
 * filtering and pagination. Ascending order matters for verification
 * flows, which need to walk the chain from the beginning.
 *
 * @param {Object} [options]
 * @param {string} [options.actor] - optional filter by actor.
 * @param {number} [options.limit] - max rows to return (default 100).
 * @param {number} [options.offset] - rows to skip (default 0).
 * @returns {Promise<Object[]>} array of log rows.
 */

//not used this function (getAllLogs)in this project
async function getAllLogs({ actor, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const values = [];

  if (actor) {
    values.push(actor);
    conditions.push(`actor = $${values.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  values.push(limit);
  const limitParamIndex = values.length;

  values.push(offset);
  const offsetParamIndex = values.length;

  const { rows } = await pool.query(
    `SELECT id, actor, action, payload, previous_hash, current_hash, created_at
     FROM logs
     ${whereClause}
     ORDER BY id ASC
     LIMIT $${limitParamIndex}
     OFFSET $${offsetParamIndex}`,
    values
  );
  return rows;
}


/**
 * Fetch ALL log entries, unpaginated, ordered ascending by id.
 *
 * Used by chain verification (GET /verify), which must walk every
 * entry from the first to the last — pagination would break that.
 * Kept separate from getAllLogs() (which is paginated, for listing UIs).
 *
 * @returns {Promise<Object[]>} every log row, oldest first.
 */
async function getAllLogsOrdered() {
    const { rows } = await pool.query(
      `SELECT id, actor, action, payload, previous_hash, current_hash, created_at
       FROM logs
       ORDER BY id ASC`
    );
    return rows;
  }




  /**
 * Fetch log entries filtered by actor and/or a created_at date range,
 * ordered by created_at ascending. Used by GET /export.
 *
 * Builds the WHERE clause **dynamically** so callers can pass any
 * combination of filters (none, actor only, dates only, or both)
 * without needing a separate hand-written query for each case.
 * Still fully parameterized — no string interpolation of values.
 *
 * @param {Object} [filters]
 * @param {string|null} [filters.actor] - exact actor match.
 * @param {string|null} [filters.startDate] - ISO date/timestamp, inclusive lower bound.
 * @param {string|null} [filters.endDate] - ISO date/timestamp, inclusive upper bound.
 * @returns {Promise<Object[]>} matching log rows, oldest first.
 */
async function getFilteredLogs({ actor, startDate, endDate } = {}) {
    const conditions = [];
    const values = [];
   
    if (actor) {
      values.push(actor);
      conditions.push(`actor = $${values.length}`);
    }
   
    if (startDate && endDate) {
      values.push(startDate, endDate);
      conditions.push(`created_at BETWEEN $${values.length - 1} AND $${values.length}`);
    } else if (startDate) {
      values.push(startDate);
      conditions.push(`created_at >= $${values.length}`);
    } else if (endDate) {
      values.push(endDate);
      conditions.push(`created_at <= $${values.length}`);
    }
   
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
   
    const { rows } = await pool.query(
      `SELECT id, actor, action, payload, previous_hash, current_hash, created_at
       FROM logs
       ${whereClause}
       ORDER BY created_at ASC`,
      values
    );
    return rows;
  }
   

  /**
 * Fetch id + current_hash for a contiguous range of log ids, ascending.
 * Used when a merkle batch completes and needs the hashes of the logs
 * it covers.
 *
 * @param {number} startId
 * @param {number} endId
 * @returns {Promise<{id: number, current_hash: string}[]>}
 */
async function getHashesInRange(startId, endId) {
    const { rows } = await pool.query(
      `SELECT id, current_hash
       FROM logs
       WHERE id BETWEEN $1 AND $2
       ORDER BY id ASC`,
      [startId, endId]
    );
    return rows;
  }

  module.exports = {
    getLatestLog,
    createLog,
    getLogById,
    getAllLogs,
    getAllLogsOrdered,
    getFilteredLogs,
    getHashesInRange,
  };




