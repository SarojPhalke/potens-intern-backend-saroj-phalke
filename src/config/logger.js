const pino = require("pino");

const isProduction = process.env.NODE_ENV === "production";

const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? "info" : "debug"),

 // Pretty-print in dev, structured JSON in prod
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
          ignore: "pid,hostname",
        },
      },

  // Never leak secrets into logs
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers['x-api-key']",
      "*.apiKey",
      "*.password",
    ],
    censor: "[REDACTED]",
  },

  base: {
    service: "tamper-evident-log-service",
    env: process.env.NODE_ENV || "development",
  },

  timestamp: pino.stdTimeFunctions.isoTime,
});

module.exports = logger;