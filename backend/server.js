const express = require("express");
const cors = require("cors");
const path = require("path");

const authRoutes = require("./routes/auth");
const clientRoutes = require("./routes/client");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Routes API
app.use("/api/auth", authRoutes);
app.use("/api/client", clientRoutes);
app.use("/api/admin", adminRoutes);

// Servir le frontend (HTML/CSS/JS) directement depuis le backend
app.get("/api/test-db", async (req, res) => {
  try {
    const pool = require("./config/db");
    const [lignes] = await pool.query("SELECT 1+1 AS resultat");
    res.json({ succes: true, message: "Connexion à la base réussie !", resultat: lignes });
  } catch (erreur) {
    res.json({ succes: false, message: "Échec de connexion", erreur: erreur.message, code: erreur.code });
  }
});
app.use(express.static(path.join(__dirname, "..", "frontend")));

app.listen(PORT, () => {
  console.log(`Serveur Portail Client MTN démarré sur http://localhost:${PORT}`);
});
