require("dotenv").config();
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "mtn_portail_client",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  ssl: { rejectUnauthorized: false },
});

module.exports = pool;
