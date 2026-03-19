/**
 * src/services/db.js — PostgreSQL connection pool
 *
 * Creates a connection pool to PostgreSQL. A pool maintains multiple
 * connections so we don't have to open/close one for every query.
 * All other modules import this and call db.query().
 */

const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.PG_HOST || "localhost",
  port: parseInt(process.env.PG_PORT || "5432"),
  database: process.env.PG_DB || "ml_platform",
  user: process.env.PG_USER || "postgres",
  password: process.env.PG_PASSWORD || "password",
  // Pool settings
  max: 10,              // max number of connections in the pool
  idleTimeoutMillis: 30000,  // close idle connections after 30 seconds
  connectionTimeoutMillis: 5000,  // fail if can't connect in 5 seconds
});

// Log when the pool connects or errors
pool.on("connect", () => {
  console.log("[DB] New client connected to PostgreSQL");
});

pool.on("error", (err) => {
  console.error("[DB] Unexpected pool error:", err.message);
});

module.exports = {
  /**
   * Execute a SQL query.
   * @param {string} text - SQL query string (use $1, $2... for parameters)
   * @param {Array} params - Parameter values
   * @returns {Promise<QueryResult>}
   *
   * Example:
   *   const result = await db.query('SELECT * FROM deployments WHERE status = $1', ['running']);
   *   console.log(result.rows);
   */
  query: (text, params) => pool.query(text, params),

  /**
   * Get a dedicated client from the pool (for transactions).
   * Remember to call client.release() when done!
   */
  getClient: () => pool.connect(),
};
