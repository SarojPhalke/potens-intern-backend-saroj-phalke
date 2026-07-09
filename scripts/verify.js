require('dotenv').config();

const { pool } = require('../src/config/db');
const logModel = require('../src/models/log.model');
const { verifyChain } = require('../src/services/verify.service');
const logger = require('../src/config/logger');

/**
 * CLI entry point for chain verification.
 *
 * This script is a thin orchestrator ONLY. It does not know how
 * verification works — that logic lives entirely in verify.service.js,
 * the same service GET /verify uses. This file's job is just:
 *
 *   Load env vars -> connect DB -> fetch logs -> call verify.service
 *     -> print result -> close DB connection
 */
async function main() {
  try {
    logger.info('CLI verify — starting chain verification');

    // Fetch logs via the existing model — same function GET /verify uses.
    const logs = await logModel.getAllLogsOrdered();

    // Delegate entirely to the shared service — no duplicated logic.
    const result = verifyChain(logs);

    printReport(result, logs.length);

    // Non-zero exit code on FAIL so this can be used in CI/cron and
    // trigger alerts based on exit status, not just log-scraping.
    if (result.status === 'FAIL') {
      process.exitCode = 1;
    }
  } catch (err) {
    logger.error({ err }, 'CLI verify — failed to run');
    console.error('\nVerification script encountered an error:');
    console.error(err.message);
    process.exitCode = 1;
  } finally {
    // Always close the pool so the CLI process actually exits —
    // an open pg Pool will otherwise keep node running indefinitely.
    await pool.end();
  }
}

/**
 * Print a clear, human-readable PASS/FAIL report to the console.
 * Kept separate from main() so the reporting format can change
 * without touching the orchestration flow.
 */
function printReport(result, totalLogs) {
  console.log('');
  console.log('========================================');
  console.log(' Tamper-Evident Log — Chain Verification');
  console.log('========================================');
  console.log(`Total logs in database : ${totalLogs}`);
  console.log(`Entries verified       : ${result.entriesVerified}`);
  console.log(`Status                 : ${result.status}`);

  if (result.status === 'FAIL') {
    console.log(`Broken entry id        : ${result.brokenEntryId}`);
    console.log(`Reason                 : ${result.reason}`);
  }

  console.log('========================================');
  console.log('');
}

main();