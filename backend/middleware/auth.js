const jwt = require("jsonwebtoken");
const pool = require("../config/db");

const CLE_SECRETE = "mtn_portail_client_cle_secrete_2026"; // en production, mettre ceci dans une variable d'environnement

function verifierToken(req, res, next) {
  const enTete = req.headers["authorization"];

  if (!enTete) {
    return res.status(401).json({ message: "Accès refusé : aucun token fourni." });
  }

  const token = enTete.split(" ")[1]; // format attendu : "Bearer <token>"

  if (!token) {
    return res.status(401).json({ message: "Accès refusé : token mal formé." });
  }

  try {
    const donnees = jwt.verify(token, CLE_SECRETE);
    req.userId = donnees.userId;
    next();
  } catch (erreur) {
    return res.status(403).json({ message: "Token invalide ou expiré." });
  }
}

// À utiliser après verifierToken : bloque l'accès si l'utilisateur n'est pas un agent MTN
async function verifierAgent(req, res, next) {
  try {
    const [lignes] = await pool.query("SELECT role FROM utilisateurs WHERE id = ?", [req.userId]);

    if (lignes.length === 0 || lignes[0].role !== "agent") {
      return res.status(403).json({ message: "Accès réservé aux agents MTN." });
    }

    next();
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur lors de la vérification du rôle." });
  }
}

module.exports = { verifierToken, verifierAgent, CLE_SECRETE };
