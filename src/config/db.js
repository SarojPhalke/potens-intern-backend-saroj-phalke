const { Pool } = require("pg");
require("dotenv").config();
const logger = require("../config/logger");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

async function connectDB() {
  try {
    const client = await pool.connect();

    logger.info("Connected to PostgreSQL"); //strcutured logging using pino module

    client.release();
  } catch (error) {
    logger.error({ err: error }, "Failed to connect to PostgreSQL");
    console.error(error.message);

    process.exit(1);
  }
}

module.exports = {
  pool,
  connectDB,
};