const { generateHash } = require('./hash.service');

/**
 * Verify a single log entry's integrity by recomputing its hash from
 * its own stored fields and comparing it to the stored current_hash.
 *
 * This does NOT touch the database and does NOT know about Express —
 * it takes a log row object and returns a verification result.
 *
 * @param {Object} logEntry - a row from the logs table.
 * @param {string} logEntry.actor
 * @param {string} logEntry.action
 * @param {Object} logEntry.payload
 * @param {string|null} logEntry.previous_hash
 * @param {string} logEntry.current_hash - the hash stored in the DB.
 * @returns {{ is_valid: boolean, expected_hash: string, stored_hash: string }}
 */
function verifyLogHash(logEntry) {
  const { actor, action, payload, previous_hash, current_hash } = logEntry;

  const expected_hash = generateHash({ actor, action, payload, previous_hash });
  const is_valid = expected_hash === current_hash;

  return {
    is_valid,
    expected_hash,
    stored_hash: current_hash,
  };
}

module.exports = {
  verifyLogHash,
};