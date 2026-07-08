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



/**
 * Verify the entire hash chain, in ascending order (oldest first).
 *
 * For every log entry, two independent checks are performed:
 *
 *   1. HASH CHECK  — recompute the hash from the entry's own fields
 *      (via hash.service.js) and confirm it matches the stored
 *      current_hash. Reuses verifyLogHash() so hashing logic lives
 *      in exactly one place (hash.service.js).
 *
 *   2. CHAIN CHECK — confirm this entry's previous_hash equals the
 *      previous entry's current_hash (or is null, for the very first
 *      entry in the table). This catches deletions/reordering that a
 *      per-entry hash check alone wouldn't catch.
 *
 * Stops at the first entry that fails either check (fail-fast) and
 * reports its id, per the assignment's "first broken entry id"
 * requirement. O(N) — one pass over N logs.
 *
 * @param {Object[]} logs - all log rows, ordered ascending by id.
 * @returns {{
*   status: 'PASS'|'FAIL',
*   entriesVerified: number,
*   brokenEntryId?: number,
*   reason?: 'hash_mismatch'|'chain_link_mismatch'
* }}
*/
function verifyChain(logs) {
 let previousLog = null;

 for (let i = 0; i < logs.length; i += 1) {
   const log = logs[i];

   // Check 1: has this entry's own data been tampered with?
   const { is_valid } = verifyLogHash(log);
   if (!is_valid) {
     return {
       status: 'FAIL',
       entriesVerified: i,
       brokenEntryId: log.id,
       reason: 'hash_mismatch',
     };
   }

   // Check 2: does this entry correctly link to the previous one?
   const expectedPreviousHash = previousLog ? previousLog.current_hash : null;
   const actualPreviousHash = log.previous_hash || null;

   if (actualPreviousHash !== expectedPreviousHash) {
     return {
       status: 'FAIL',
       entriesVerified: i,
       brokenEntryId: log.id,
       reason: 'chain_link_mismatch',
     };
   }

   previousLog = log;
 }

 return {
   status: 'PASS',
   entriesVerified: logs.length,
 };
}

module.exports = {
  verifyLogHash,
  verifyChain,
};