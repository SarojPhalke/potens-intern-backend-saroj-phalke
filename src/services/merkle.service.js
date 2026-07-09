const { sha256 } = require('../utils/crypto');

const DEFAULT_BATCH_SIZE = 10;

/**
 * How many logs go into one batch. Configurable via MERKLE_BATCH_SIZE
 * in .env; defaults to 10.
 *
 * @returns {number}
 */
function getBatchSize() {
  const configured = parseInt(process.env.MERKLE_BATCH_SIZE, 10);
  return Number.isInteger(configured) && configured > 0 ? configured : DEFAULT_BATCH_SIZE;
}

/**
 * Compute a single batch hash from an ordered array of individual
 * log current_hash values. This is a simplified Merkle root:
 *
 *   batch_hash = SHA256(H1 + H2 + ... + Hn)
 *
 * Pure function, no DB access — mirrors how hash.service.js only
 * generates hashes and never touches the database.
 *
 * @param {string[]} hashes - ordered current_hash values for the batch.
 * @returns {string} batch_hash - SHA256 hex digest.
 */
function computeBatchHash(hashes) {
  if (!Array.isArray(hashes) || hashes.length === 0) {
    throw new Error('computeBatchHash requires a non-empty array of hashes');
  }
  const concatenated = hashes.join('');
  return sha256(concatenated);
}

/**
 * Given the id of the log that was just inserted, determine whether
 * a batch has just been completed, and if so, return its range.
 *
 * A batch completes whenever the latest log id is an exact multiple
 * of the batch size — e.g. with batchSize=10, ids 10, 20, 30... each
 * complete a batch covering the 10 ids before and including it.
 *
 * @param {number} latestLogId - id of the log row just inserted.
 * @returns {{ startId: number, endId: number, batchSize: number } | null}
 *   the completed batch's range, or null if no batch was completed.
 */
function getBatchRangeIfComplete(latestLogId) {
  const batchSize = getBatchSize();

  if (!Number.isInteger(latestLogId) || latestLogId % batchSize !== 0) {
    return null;
  }

  const endId = latestLogId;
  const startId = endId - batchSize + 1;

  return { startId, endId, batchSize };
}

module.exports = {
  computeBatchHash,
  getBatchRangeIfComplete,
  getBatchSize,
};