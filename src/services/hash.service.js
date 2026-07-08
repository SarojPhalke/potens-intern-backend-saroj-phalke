const { sha256 } = require('../utils/crypto');

/**
 * Deterministically stringify a value so that the same object always
 * produces the same string, regardless of key insertion order.
 * This is critical: if JSON.stringify() were used directly, two payloads
 * with identical data but different key order would produce different
 * hashes, breaking chain verification.
 *
 * @param {*} value
 * @returns {string}
 */
function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const sortedKeys = Object.keys(value).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`
  );
  return `{${pairs.join(',')}}`;
}

/**
 * Build the canonical string representation of a log entry.
 * The field order here is part of the hashing contract — it must never
 * change once the service is in production, or every previously
 * generated hash becomes unverifiable.
 *
 * Canonical format:
 *   actor|action|stableStringify(payload)|previous_hash
 *
 * @param {Object} params
 * @param {string} params.actor
 * @param {string} params.action
 * @param {Object} params.payload
 * @param {string|null} [params.previous_hash]
 * @returns {string}
 */
function buildCanonicalString({ actor, action, payload, previous_hash }) {
  const parts = [
    String(actor),
    String(action),
    stableStringify(payload),
    previous_hash ? String(previous_hash) : '',
  ];
  return parts.join('|');
}

/**
 * Generate the current_hash for a log entry.
 *
 * Pure function: given identical inputs, it always returns the identical
 * hash. It performs NO database access and NO insertion — the caller
 * (e.g. log.controller.js) is responsible for fetching the previous
 * entry's current_hash and for persisting the record.
 *
 * Flow:
 *   actor -> action -> payload -> previous_hash -> SHA256 -> current_hash
 *
 * @param {Object} params
 * @param {string} params.actor - Who performed the action.
 * @param {string} params.action - What action was performed.
 * @param {Object} params.payload - Arbitrary JSON payload describing the event.
 * @param {string|null} [params.previous_hash] - current_hash of the prior
 *   log entry, or null/undefined for the very first entry in the chain.
 * @returns {string} current_hash - SHA256 hex digest of the canonical entry.
 * @throws {Error} if actor, action, or payload are missing.
 */
function generateHash({ actor, action, payload, previous_hash = null }) {
  if (!actor || typeof actor !== 'string') {
    throw new Error('actor is required and must be a string');
  }
  if (!action || typeof action !== 'string') {
    throw new Error('action is required and must be a string');
  }
  if (payload === undefined || payload === null || typeof payload !== 'object') {
    throw new Error('payload is required and must be an object');
  }

  const canonicalString = buildCanonicalString({
    actor,
    action,
    payload,
    previous_hash,
  });

  return sha256(canonicalString);
}

module.exports = {
  generateHash,
  buildCanonicalString,
  stableStringify,
};