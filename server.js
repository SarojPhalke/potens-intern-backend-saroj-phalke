require("dotenv").config();

const app = require("./src/app");
const { connectDB } = require("./src/config/db");
const logger = require("./src/config/logger");

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDB();

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error({ err: error }, "Unable to start server");
    process.exit(1);
    //process.exit(1) can cut off the log write if Pino hasn't flushed to stdout yet, since Pino's default transport is asynchronous
   // The fix (only if you hit it) is to use pino.destination({ sync: true }) for the base logger, or delay process.exit by one tick with setImmediate(() => process.exit(1)).
  }
}

startServer();

