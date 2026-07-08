const express = require("express");

const app = express();

// Structured request logging (must come early, before routes)
const loggerMiddleware = require("./middleware/logger.middleware");
app.use(loggerMiddleware);

// Middleware to parse JSON request bodies
app.use(express.json());

// Routes
const logRoutes = require("./routes/log.routes");
//debug code
//console.log("typeof logRoutes:", typeof logRoutes);
app.use("/", logRoutes);

// Test Route
app.get("/", (req, res) => {
  res.status(200).json({
    message: "Tamper Evident Log Service Running"
  });
});

// Error Middleware (ALWAYS LAST)
const errorHandler = require("./middleware/error.middleware");
app.use(errorHandler);

module.exports = app;