const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

const pool = require("../config/db");
const { verifierToken } = require("../middleware/auth");

router.use(verifierToken);

// Transforme une ligne SQL "utilisateurs" en objet propre pour le front-end
function formaterUtilisateur(ligne) {
  const forfaitActif = ligne.forfait_nom
    ? {
        nom: ligne.forfait_nom,
        dataMoTotal: ligne.forfait_data_total,
        dataMoRestant: ligne.forfait_data_restant,
        appelsMinTotal: ligne.forfait_appels_total,
        appelsMinRestant: ligne.forfait_appels_restant,
        smsTotal: ligne.forfait_sms_total,
        smsRestant: ligne.forfait_sms_restant,
        dateAchat: ligne.forfait_date_achat,
        dateExpiration: ligne.forfait_date_expiration,
      }
    : null;

  return {
    id: ligne.id,
    nom: ligne.nom,
    email: ligne.email,
    role: ligne.role,
    solde: ligne.solde,
    forfaitActif,
  };
}

// GET /api/client/profile
router.get("/profile", async (req, res) => {
  try {
    const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.userId]);

    if (lignes.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    return res.json(formaterUtilisateur(lignes[0]));
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// PUT /api/client/profile   body: { nom?, ancienMotDePasse?, nouveauMotDePasse? }
router.put("/profile", async (req, res) => {
  try {
    const { nom, ancienMotDePasse, nouveauMotDePasse } = req.body;

    const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.userId]);

    if (lignes.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    const utilisateur = lignes[0];

    if (nom && nom.trim()) {
      await pool.query("UPDATE utilisateurs SET nom = ? WHERE id = ?", [nom.trim(), req.userId]);
      utilisateur.nom = nom.trim();
    }

    if (nouveauMotDePasse) {
      if (!ancienMotDePasse) {
        return res.status(400).json({ message: "Veuillez saisir votre mot de passe actuel." });
      }

      const motDePasseValide = bcrypt.compareSync(ancienMotDePasse, utilisateur.mot_de_passe);

      if (!motDePasseValide) {
        return res.status(401).json({ message: "Mot de passe actuel incorrect." });
      }

      if (nouveauMotDePasse.length < 4) {
        return res.status(400).json({ message: "Le nouveau mot de passe doit contenir au moins 4 caractères." });
      }

      const nouveauHache = bcrypt.hashSync(nouveauMotDePasse, 10);
      await pool.query("UPDATE utilisateurs SET mot_de_passe = ? WHERE id = ?", [nouveauHache, req.userId]);
    }

    return res.json(formaterUtilisateur(utilisateur));
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /api/client/forfaits
router.get("/forfaits", async (req, res) => {
  try {
    const [forfaits] = await pool.query("SELECT * FROM forfaits");

    const forfaitsFormates = forfaits.map((f) => ({
      id: f.id,
      nom: f.nom,
      prix: f.prix,
      dataMo: f.data_mo,
      appelsMin: f.appels_min,
      sms: f.sms,
      validiteJours: f.validite_jours,
    }));

    return res.json(forfaitsFormates);
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /api/client/historique
router.get("/historique", async (req, res) => {
  try {
    const [historique] = await pool.query(
      "SELECT type, description, montant, date FROM historique WHERE utilisateur_id = ? ORDER BY date DESC",
      [req.userId]
    );

    return res.json(historique);
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/client/recharge   body: { montant }
router.post("/recharge", async (req, res) => {
  try {
    const { montant } = req.body;

    if (!montant || montant <= 0) {
      return res.status(400).json({ message: "Le montant doit être supérieur à 0." });
    }

    await pool.query("UPDATE utilisateurs SET solde = solde + ? WHERE id = ?", [montant, req.userId]);
    await pool.query(
      "INSERT INTO historique (utilisateur_id, type, description, montant) VALUES (?, ?, ?, ?)",
      [req.userId, "recharge", `Recharge de crédit de ${montant} FCFA`, montant]
    );

    const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.userId]);
    return res.json(formaterUtilisateur(lignes[0]));
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/client/achat-forfait   body: { forfaitId }
router.post("/achat-forfait", async (req, res) => {
  try {
    const { forfaitId } = req.body;

    const [forfaits] = await pool.query("SELECT * FROM forfaits WHERE id = ?", [forfaitId]);

    if (forfaits.length === 0) {
      return res.status(404).json({ message: "Forfait introuvable." });
    }

    const forfaitChoisi = forfaits[0];

    const [lignesUtilisateur] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.userId]);
    const utilisateur = lignesUtilisateur[0];

    if (utilisateur.solde < forfaitChoisi.prix) {
      return res.status(400).json({ message: "Solde insuffisant. Veuillez recharger votre crédit." });
    }

    const maintenant = new Date();
    const expiration = new Date(maintenant);
    expiration.setDate(expiration.getDate() + forfaitChoisi.validite_jours);

    await pool.query(
      `UPDATE utilisateurs SET
        solde = solde - ?,
        forfait_nom = ?,
        forfait_data_total = ?, forfait_data_restant = ?,
        forfait_appels_total = ?, forfait_appels_restant = ?,
        forfait_sms_total = ?, forfait_sms_restant = ?,
        forfait_date_achat = ?, forfait_date_expiration = ?
      WHERE id = ?`,
      [
        forfaitChoisi.prix,
        forfaitChoisi.nom,
        forfaitChoisi.data_mo, forfaitChoisi.data_mo,
        forfaitChoisi.appels_min, forfaitChoisi.appels_min,
        forfaitChoisi.sms, forfaitChoisi.sms,
        maintenant, expiration,
        req.userId,
      ]
    );

    await pool.query(
      "INSERT INTO historique (utilisateur_id, type, description, montant) VALUES (?, ?, ?, ?)",
      [req.userId, "achat_forfait", `Achat du forfait ${forfaitChoisi.nom}`, -forfaitChoisi.prix]
    );

    const [lignesApres] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.userId]);
    return res.json(formaterUtilisateur(lignesApres[0]));
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/client/simuler-usage   body: { dataMo?, appelsMin?, sms? }
router.post("/simuler-usage", async (req, res) => {
  try {
    const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.userId]);
    const utilisateur = lignes[0];

    if (!utilisateur.forfait_nom) {
      return res.status(400).json({ message: "Aucun forfait actif à consommer." });
    }

    const dataMo = req.body.dataMo ?? Math.floor(Math.random() * 80) + 20;
    const appelsMin = req.body.appelsMin ?? Math.floor(Math.random() * 10) + 1;
    const sms = req.body.sms ?? Math.floor(Math.random() * 5);

    const nouvelleData = Math.max(0, utilisateur.forfait_data_restant - dataMo);
    const nouveauxAppels = Math.max(0, utilisateur.forfait_appels_restant - appelsMin);
    const nouveauxSms = Math.max(0, utilisateur.forfait_sms_restant - sms);

    await pool.query(
      `UPDATE utilisateurs SET
        forfait_data_restant = ?, forfait_appels_restant = ?, forfait_sms_restant = ?
      WHERE id = ?`,
      [nouvelleData, nouveauxAppels, nouveauxSms, req.userId]
    );

    await pool.query(
      "INSERT INTO historique (utilisateur_id, type, description, montant) VALUES (?, ?, ?, ?)",
      [req.userId, "consommation", `Utilisation : ${dataMo} Mo, ${appelsMin} min d'appel, ${sms} SMS`, 0]
    );

    const [lignesApres] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.userId]);
    return res.json(formaterUtilisateur(lignesApres[0]));
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
