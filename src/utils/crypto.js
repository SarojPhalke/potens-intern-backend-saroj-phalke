const crypto = require('crypto');

/**
 * Generate a SHA256 hash (hex digest) for a given string input.
 *
 * @param {string} data - The input string to hash.
 * @returns {string} SHA256 hash in hexadecimal format.
 */
function sha256(data) {
  return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

module.exports = { sha256 };