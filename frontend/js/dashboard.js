const API_BASE = "/api";
const token = localStorage.getItem("token");

// Pas de token => retour à la page de connexion
if (!token) {
  window.location.href = "index.html";
}

const enTetesAuth = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const elementNom = document.getElementById("nomUtilisateur");
const elementSolde = document.getElementById("soldeUtilisateur");
const elementForfaitActif = document.getElementById("forfaitActifConteneur");
const elementListeForfaits = document.getElementById("listeForfaits");
const elementListeHistorique = document.getElementById("listeHistorique");
const btnSimulerUsage = document.getElementById("btnSimulerUsage");
const messageGlobal = document.getElementById("messageGlobal");

function afficherMessage(texte, estErreur = true) {
  messageGlobal.textContent = texte;
  messageGlobal.style.color = estErreur ? "#c0392b" : "#1f8a4c";
  setTimeout(() => (messageGlobal.textContent = ""), 4000);
}

function formaterFCFA(nombre) {
  return `${Number(nombre).toLocaleString("fr-FR")} FCFA`;
}

function formaterDate(dateISO) {
  return new Date(dateISO).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Récupération et affichage du profil ---
async function chargerProfil() {
  const reponse = await fetch(`${API_BASE}/client/profile`, { headers: enTetesAuth });

  if (reponse.status === 401 || reponse.status === 403) {
    localStorage.clear();
    window.location.href = "index.html";
    return null;
  }

  const utilisateur = await reponse.json();
  elementNom.textContent = `Bonjour, ${utilisateur.nom}`;
  elementSolde.textContent = formaterFCFA(utilisateur.solde);

  if (utilisateur.role === "agent") {
    document.getElementById("lienEspaceAgent").classList.remove("cache");
  }

  afficherForfaitActif(utilisateur.forfaitActif);
  return utilisateur;
}

function afficherForfaitActif(forfait) {
  if (!forfait) {
    elementForfaitActif.innerHTML = `<p class="texte-vide">Aucun forfait actif pour le moment.</p>`;
    btnSimulerUsage.classList.add("cache");
    return;
  }

  btnSimulerUsage.classList.remove("cache");

  const pourcentage = (restant, total) =>
    total === 0 ? 0 : Math.round((restant / total) * 100);

  const creerAnneau = (label, restant, total, unite) => `
    <div class="anneau-bloc">
      <div class="anneau" style="--pct:${pourcentage(restant, total)}">
        <div class="anneau-contenu">
          <span class="anneau-valeur">${restant}</span>
          <span class="anneau-total">/ ${total} ${unite}</span>
        </div>
      </div>
      <span class="anneau-label">${label}</span>
    </div>
  `;

  elementForfaitActif.innerHTML = `
    <div class="bloc-forfait-actif">
      <div class="forfait-entete">
        <strong>${forfait.nom}</strong>
        <span class="forfait-expiration">Expire le ${formaterDate(forfait.dateExpiration)}</span>
      </div>

      <div class="grille-anneaux">
        ${creerAnneau("Data", forfait.dataMoRestant, forfait.dataMoTotal, "Mo")}
        ${creerAnneau("Appels", forfait.appelsMinRestant, forfait.appelsMinTotal, "min")}
        ${creerAnneau("SMS", forfait.smsRestant, forfait.smsTotal, "")}
      </div>
    </div>
  `;
}

// --- Liste des forfaits disponibles à l'achat ---
async function chargerForfaits() {
  const reponse = await fetch(`${API_BASE}/client/forfaits`, { headers: enTetesAuth });
  const forfaits = await reponse.json();

  elementListeForfaits.innerHTML = forfaits
    .map(
      (forfait) => `
      <div class="carte-forfait">
        <h3>${forfait.nom}</h3>
        <p class="prix">${formaterFCFA(forfait.prix)}</p>
        <ul>
          <li>${forfait.dataMo} Mo de data</li>
          <li>${forfait.appelsMin} min d'appel</li>
          <li>${forfait.sms} SMS</li>
          <li>Validité : ${forfait.validiteJours} jour(s)</li>
        </ul>
        <button class="bouton-principal" data-forfait-id="${forfait.id}">Acheter</button>
      </div>
    `
    )
    .join("");

  document.querySelectorAll("[data-forfait-id]").forEach((bouton) => {
    bouton.addEventListener("click", () => acheterForfait(bouton.dataset.forfaitId));
  });
}

async function acheterForfait(forfaitId) {
  const reponse = await fetch(`${API_BASE}/client/achat-forfait`, {
    method: "POST",
    headers: enTetesAuth,
    body: JSON.stringify({ forfaitId }),
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors de l'achat.");
    return;
  }

  afficherMessage("Forfait acheté avec succès !", false);
  await Promise.all([chargerProfil(), chargerHistorique()]);
}

// --- Historique ---
async function chargerHistorique() {
  const reponse = await fetch(`${API_BASE}/client/historique`, { headers: enTetesAuth });
  const historique = await reponse.json();

  const classePastilleParType = {
    achat_forfait: "pastille-achat",
    recharge: "pastille-recharge",
    consommation: "pastille-consommation",
    creation_compte: "pastille-compte",
  };

  elementListeHistorique.innerHTML = historique
    .map((ligne) => {
      const classeMontant =
        ligne.montant > 0 ? "montant-positif" : ligne.montant < 0 ? "montant-negatif" : "";
      const signe = ligne.montant > 0 ? "+" : "";
      const classePastille = classePastilleParType[ligne.type] || "pastille-consommation";
      return `
        <div class="ligne-historique">
          <span class="pastille ${classePastille}"></span>
          <div class="detail-historique">
            <div>${ligne.description}</div>
            <div class="date-historique">${formaterDate(ligne.date)}</div>
          </div>
          <div class="${classeMontant}">${ligne.montant !== 0 ? `${signe}${ligne.montant} FCFA` : ""}</div>
        </div>
      `;
    })
    .join("");
}

// --- Recharge de crédit ---
document.getElementById("btnRecharge").addEventListener("click", async () => {
  const champMontant = document.getElementById("montantRecharge");
  const montant = Number(champMontant.value);

  if (!montant || montant <= 0) {
    afficherMessage("Veuillez saisir un montant valide.");
    return;
  }

  const reponse = await fetch(`${API_BASE}/client/recharge`, {
    method: "POST",
    headers: enTetesAuth,
    body: JSON.stringify({ montant }),
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors de la recharge.");
    return;
  }

  champMontant.value = "";
  afficherMessage("Recharge effectuée avec succès !", false);
  await Promise.all([chargerProfil(), chargerHistorique()]);
});

// --- Simuler une utilisation (pour la démo) ---
btnSimulerUsage.addEventListener("click", async () => {
  const reponse = await fetch(`${API_BASE}/client/simuler-usage`, {
    method: "POST",
    headers: enTetesAuth,
    body: JSON.stringify({}),
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors de la simulation.");
    return;
  }

  afficherMessage("Consommation simulée avec succès.", false);
  afficherForfaitActif(donnees.forfaitActif);
  await chargerHistorique();
});

// --- Déconnexion ---
document.getElementById("btnDeconnexion").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

// --- Initialisation ---
(async function initialiser() {
  await chargerProfil();
  await chargerForfaits();
  await chargerHistorique();
})();
