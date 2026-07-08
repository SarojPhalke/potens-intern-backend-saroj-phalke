const pinoHttp = require("pino-http");
const crypto = require("crypto");
const logger = require("../config/logger");

const loggerMiddleware = pinoHttp({
  logger,

  genReqId: (req, res) => {
    const existing = req.headers["x-request-id"];
    const id = existing || crypto.randomUUID();
    res.setHeader("x-request-id", id);
    return id;
  },

  customLogLevel: (req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },

  customSuccessMessage: (req, res ,responseTime) => {
    return `${req.method} ${req.url} completed ${res.statusCode} (${responseTime}ms)`;
  },

  customErrorMessage: (req, res, err) => {
    return `${req.method} ${req.url} failed ${res.statusCode}: ${err.message}`;
  },

   // Explicitly attach responseTime as a structured field too (not just in the message string)
   customAttributeKeys: {
    responseTime: "responseTimeMs",
  },

  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      remoteAddress: req.remoteAddress,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
});

module.exports = loggerMiddleware;