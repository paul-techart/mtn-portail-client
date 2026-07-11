const express = require("express");
const router = express.Router();

const pool = require("../config/db");
const { verifierToken, verifierAgent } = require("../middleware/auth");

router.use(verifierToken);
router.use(verifierAgent);

// GET /api/admin/clients   -> liste résumée de tous les clients
router.get("/clients", async (req, res) => {
  try {
    const [clients] = await pool.query(
      "SELECT id, nom, email, solde, forfait_nom, bloque FROM utilisateurs WHERE role != 'agent'"
    );

    const clientsFormates = clients.map((c) => ({
      id: c.id,
      nom: c.nom,
      email: c.email,
      solde: c.solde,
      forfaitActif: c.forfait_nom,
      bloque: !!c.bloque,
    }));

    return res.json(clientsFormates);
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// GET /api/admin/clients/:id   -> détail complet d'un client (avec historique)
router.get("/clients/:id", async (req, res) => {
  try {
    const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.params.id]);

    if (lignes.length === 0) {
      return res.status(404).json({ message: "Client introuvable." });
    }

    const client = lignes[0];

    const [historique] = await pool.query(
      "SELECT type, description, montant, date FROM historique WHERE utilisateur_id = ? ORDER BY date DESC",
      [req.params.id]
    );

    return res.json({
      id: client.id,
      nom: client.nom,
      email: client.email,
      solde: client.solde,
      role: client.role,
      bloque: !!client.bloque,
      forfaitActif: client.forfait_nom
        ? {
            nom: client.forfait_nom,
            dataMoRestant: client.forfait_data_restant,
            dataMoTotal: client.forfait_data_total,
            appelsMinRestant: client.forfait_appels_restant,
            appelsMinTotal: client.forfait_appels_total,
            smsRestant: client.forfait_sms_restant,
            smsTotal: client.forfait_sms_total,
            dateExpiration: client.forfait_date_expiration,
          }
        : null,
      historique,
    });
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/admin/clients/:id/recharger   body: { montant }
router.post("/clients/:id/recharger", async (req, res) => {
  try {
    const { montant } = req.body;

    if (!montant || montant <= 0) {
      return res.status(400).json({ message: "Le montant doit être supérieur à 0." });
    }

    const [lignes] = await pool.query("SELECT id FROM utilisateurs WHERE id = ?", [req.params.id]);

    if (lignes.length === 0) {
      return res.status(404).json({ message: "Client introuvable." });
    }

    await pool.query("UPDATE utilisateurs SET solde = solde + ? WHERE id = ?", [montant, req.params.id]);
    await pool.query(
      "INSERT INTO historique (utilisateur_id, type, description, montant) VALUES (?, ?, ?, ?)",
      [req.params.id, "recharge", `Recharge de ${montant} FCFA effectuée par un agent MTN`, montant]
    );

    const [lignesApres] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.params.id]);
    const client = lignesApres[0];

    return res.json({
      id: client.id,
      nom: client.nom,
      email: client.email,
      solde: client.solde,
      forfaitActif: client.forfait_nom,
    });
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/admin/clients/:id/achat-forfait   body: { forfaitId }
// Permet à un agent d'attribuer un forfait à un client (paiement en agence par exemple)
router.post("/clients/:id/achat-forfait", async (req, res) => {
  try {
    const { forfaitId } = req.body;

    const [forfaits] = await pool.query("SELECT * FROM forfaits WHERE id = ?", [forfaitId]);

    if (forfaits.length === 0) {
      return res.status(404).json({ message: "Forfait introuvable." });
    }

    const forfaitChoisi = forfaits[0];

    const [lignesClient] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [req.params.id]);

    if (lignesClient.length === 0) {
      return res.status(404).json({ message: "Client introuvable." });
    }

    const client = lignesClient[0];

    if (client.solde < forfaitChoisi.prix) {
      return res.status(400).json({ message: "Solde du client insuffisant pour ce forfait." });
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
        req.params.id,
      ]
    );

    await pool.query(
      "INSERT INTO historique (utilisateur_id, type, description, montant) VALUES (?, ?, ?, ?)",
      [req.params.id, "achat_forfait", `Forfait ${forfaitChoisi.nom} attribué par un agent MTN`, -forfaitChoisi.prix]
    );

    return res.json({ message: "Forfait attribué avec succès." });
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/admin/clients/:id/bloquer   -> bascule le statut bloqué/débloqué
router.post("/clients/:id/bloquer", async (req, res) => {
  try {
    const [lignes] = await pool.query("SELECT role, bloque FROM utilisateurs WHERE id = ?", [req.params.id]);

    if (lignes.length === 0) {
      return res.status(404).json({ message: "Client introuvable." });
    }

    if (lignes[0].role === "agent") {
      return res.status(403).json({ message: "Impossible de bloquer un compte agent." });
    }

    const nouveauStatut = lignes[0].bloque ? 0 : 1;
    await pool.query("UPDATE utilisateurs SET bloque = ? WHERE id = ?", [nouveauStatut, req.params.id]);

    return res.json({
      message: nouveauStatut ? "Compte bloqué avec succès." : "Compte débloqué avec succès.",
      bloque: !!nouveauStatut,
    });
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// DELETE /api/admin/clients/:id   -> supprime définitivement un compte client
router.delete("/clients/:id", async (req, res) => {
  try {
    const [lignes] = await pool.query("SELECT role FROM utilisateurs WHERE id = ?", [req.params.id]);

    if (lignes.length === 0) {
      return res.status(404).json({ message: "Client introuvable." });
    }

    if (lignes[0].role === "agent") {
      return res.status(403).json({ message: "Impossible de supprimer un compte agent." });
    }

    // Grâce à ON DELETE CASCADE sur la table historique, son historique est supprimé automatiquement
    await pool.query("DELETE FROM utilisateurs WHERE id = ?", [req.params.id]);

    return res.json({ message: "Compte supprimé avec succès." });
  } catch (erreur) {
    console.error(erreur);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
