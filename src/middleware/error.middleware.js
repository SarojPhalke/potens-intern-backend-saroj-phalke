const logger = require("../config/logger");

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  logger.error(
    {
      err,
      reqId: req.id,
      method: req.method,
      url: req.originalUrl,
      statusCode,
    },
    err.message || "Unhandled error"
  );

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
};

module.exports = errorHandler;