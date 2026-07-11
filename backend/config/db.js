const mysql = require("mysql2/promise");

// Paramètres par défaut de XAMPP : MySQL tourne sur localhost, utilisateur "root",
// et n'a en général AUCUN mot de passe tant que tu n'en as pas défini un toi-même.
// Si ton MySQL a un mot de passe, change juste DB_PASSWORD ci-dessous (ou via variable d'environnement).
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "mtn_portail_client",
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
});

module.exports = pool;
