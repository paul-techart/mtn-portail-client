const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const router = express.Router();

const pool = require("../config/db");
const { CLE_SECRETE } = require("../middleware/auth");

// Code secret à donner uniquement aux agents MTN pour créer un compte agent.
const CODE_AGENT = "MTN-AGENT-2026";

// POST /api/auth/register
router.post("/register", async (req, res) => {
  try {
    const { nom, email, motDePasse, codeAgent } = req.body;

    if (!nom || !email || !motDePasse) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires." });
    }

    const [existants] = await pool.query("SELECT id FROM utilisateurs WHERE email = ?", [email]);

    if (existants.length > 0) {
      return res.status(409).json({ message: "Un compte existe déjà avec cet email." });
    }

    const motDePasseHache = bcrypt.hashSync(motDePasse, 10);
    const role = codeAgent && codeAgent === CODE_AGENT ? "agent" : "client";

    const [resultat] = await pool.query(
      "INSERT INTO utilisateurs (nom, email, mot_de_passe, role, solde) VALUES (?, ?, ?, ?, 0)",
      [nom, email, motDePasseHache, role]
    );

    await pool.query(
      "INSERT INTO historique (utilisateur_id, type, description, montant) VALUES (?, ?, ?, ?)",
      [resultat.insertId, "creation_compte", "Création du compte client", 0]
    );

    return res.status(201).json({ message: "Compte créé avec succès. Vous pouvez vous connecter." });
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur lors de l'inscription." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, motDePasse } = req.body;

    if (!email || !motDePasse) {
      return res.status(400).json({ message: "Email et mot de passe requis." });
    }

    const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE email = ?", [email]);

    if (lignes.length === 0) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect." });
    }

    const utilisateur = lignes[0];

    if (utilisateur.bloque) {
      return res.status(403).json({ message: "Ce compte a été bloqué. Veuillez contacter le service client MTN." });
    }

    const motDePasseValide = bcrypt.compareSync(motDePasse, utilisateur.mot_de_passe);

    if (!motDePasseValide) {
      return res.status(401).json({ message: "Email ou mot de passe incorrect." });
    }

    const token = jwt.sign({ userId: utilisateur.id }, CLE_SECRETE, { expiresIn: "2h" });

    return res.json({
      message: "Connexion réussie.",
      token,
      utilisateur: {
        id: utilisateur.id,
        nom: utilisateur.nom,
        email: utilisateur.email,
        role: utilisateur.role,
      },
    });
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur lors de la connexion." });
  }
});

module.exports = router;
