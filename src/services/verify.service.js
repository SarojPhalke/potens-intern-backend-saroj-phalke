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


/**
 * Verify the chain using merkle batches as a fast first-pass filter,
 * only falling back to a full per-log scan for a batch that actually
 * fails — instead of always scanning every log (what verifyChain does).
 *
 * THREE TIERS:
 *
 *   Tier 1 (informational, O(batches)):
 *     Recompute a Merkle root purely from the already-stored
 *     batch_hash values. Returned to the caller so it can optionally
 *     be compared against a root recorded elsewhere (e.g. an earlier
 *     verify call, or an externally-anchored value). NOTE: a root
 *     recomputed from the same DB it's meant to protect doesn't by
 *     itself prove nothing was tampered with — see the caveat below.
 *
 *   Tier 2 (per batch, cheap path):
 *     For each batch, fetch its log rows and recompute batch_hash
 *     from their current_hash values. If it matches the stored
 *     batch_hash, the batch is trusted as a whole — its logs are
 *     NOT individually re-hashed via the full canonical-string +
 *     payload computation, and their chain links are not
 *     individually re-checked. This is the actual speedup: passing
 *     batches skip the expensive per-entry work verifyChain() always
 *     does.
 *
 *   Tier 3 (only on failure, expensive path):
 *     If a batch's recomputed hash doesn't match, fall back to a
 *     full verifyLogHash + chain-link check — but ONLY within that
 *     one batch's log range — to pinpoint the exact broken entry.
 *
 *   A cheap cross-batch boundary check also runs on every batch
 *   (O(1) each): does this batch's first log's previous_hash equal
 *   the previous batch's last log's current_hash? This catches
 *   deletion/reordering across a batch boundary that a within-batch
 *   check alone would miss.
 *
 * CAVEAT: this function only covers logs that have been rolled into
 * a completed batch. Any logs inserted since the last completed
 * batch (a "partial" batch, not yet 10 entries) are NOT covered here
 * — pair this with verifyChain() on the tail if you need full
 * coverage including not-yet-batched logs.
 *
 * @param {Object[]} batches - all merkle_batches rows, ordered
 *   ascending by start_log_id (e.g. from merkleModel.getAllBatches()).
 * @param {(startId: number, endId: number) => Promise<Object[]>} logsFetcherForRange
 *   async function returning full log rows (id, actor, action,
 *   payload, previous_hash, current_hash) for a given id range,
 *   ordered ascending by id. E.g. a range-scoped wrapper around
 *   logModel.getFilteredLogs, or a dedicated getLogsInRange().
 * @returns {Promise<{
*   status: 'PASS'|'FAIL',
*   entriesVerified: number,
*   batchesVerified: number,
*   merkleRoot: string|null,
*   brokenEntryId?: number,
*   brokenBatchId?: number,
*   reason?: 'hash_mismatch'|'chain_link_mismatch'|'batch_hash_mismatch'
* }>}
*/
async function verifyChainWithMerkle(batches, logsFetcherForRange) {
 if (!Array.isArray(batches) || batches.length === 0) {
   return {
     status: 'PASS',
     entriesVerified: 0,
     batchesVerified: 0,
     merkleRoot: null,
   };
 }

 // Tier 1: root over the stored batch_hash values (cheap, O(batches)).
 const merkleRoot = merkleService.computeMerkleRoot(batches.map((b) => b.batch_hash));

 let previousLog = null; // last verified log, for cross-batch boundary checks
 let entriesVerified = 0;

 for (let b = 0; b < batches.length; b += 1) {
   const batch = batches[b];
   const rows = await logsFetcherForRange(batch.start_log_id, batch.end_log_id);

   // Cross-batch boundary check (O(1)) — does this batch correctly
   // chain onto the previous one?
   const firstRow = rows[0];
   const expectedBoundaryHash = previousLog ? previousLog.current_hash : null;
   const actualBoundaryHash = firstRow.previous_hash || null;

   if (actualBoundaryHash !== expectedBoundaryHash) {
     return {
       status: 'FAIL',
       entriesVerified,
       batchesVerified: b,
       merkleRoot,
       brokenEntryId: firstRow.id,
       brokenBatchId: batch.id,
       reason: 'chain_link_mismatch',
     };
   }

   // Tier 2: does this batch's data still match its stored batch_hash?
   const hashes = rows.map((row) => row.current_hash);
   const recomputedBatchHash = merkleService.computeBatchHash(hashes);

   if (recomputedBatchHash === batch.batch_hash) {
     // Trusted as a whole — skip per-entry verification entirely.
     entriesVerified += rows.length;
     previousLog = rows[rows.length - 1];
     continue;
   }

   // Tier 3: batch failed -> scan only THIS batch's logs to find
   // the exact broken entry (reuses the same per-entry logic as
   // verifyChain(), just scoped to a small range).
   let localPreviousLog = previousLog;

   for (let i = 0; i < rows.length; i += 1) {
     const log = rows[i];

     const { is_valid } = verifyLogHash(log);
     if (!is_valid) {
       return {
         status: 'FAIL',
         entriesVerified,
         batchesVerified: b,
         merkleRoot,
         brokenEntryId: log.id,
         brokenBatchId: batch.id,
         reason: 'hash_mismatch',
       };
     }

     const expectedPreviousHash = localPreviousLog ? localPreviousLog.current_hash : null;
     const actualPreviousHash = log.previous_hash || null;

     if (actualPreviousHash !== expectedPreviousHash) {
       return {
         status: 'FAIL',
         entriesVerified,
         batchesVerified: b,
         merkleRoot,
         brokenEntryId: log.id,
         brokenBatchId: batch.id,
         reason: 'chain_link_mismatch',
       };
     }

     entriesVerified += 1;
     localPreviousLog = log;
   }

   // Every individual log in this batch checked out, yet the batch
   // hash itself didn't match — the batch_hash row was tampered
   // with directly (or is stale), not the underlying logs.
   return {
     status: 'FAIL',
     entriesVerified,
     batchesVerified: b,
     merkleRoot,
     brokenBatchId: batch.id,
     reason: 'batch_hash_mismatch',
   };
 }

 return {
   status: 'PASS',
   entriesVerified,
   batchesVerified: batches.length,
   merkleRoot,
 };
}

module.exports = {
  verifyLogHash,
  verifyChain,
  verifyChainWithMerkle,
};