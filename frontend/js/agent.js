const API_BASE = "/api";
const token = localStorage.getItem("token");

if (!token) {
  window.location.href = "index.html";
}

const enTetesAuth = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

const messageGlobal = document.getElementById("messageGlobal");
const listeClients = document.getElementById("listeClients");
const carteDetailClient = document.getElementById("carteDetailClient");
const detailClientConteneur = document.getElementById("detailClientConteneur");
const titreDetailClient = document.getElementById("titreDetailClient");
const listeHistoriqueClient = document.getElementById("listeHistoriqueClient");

let clientsCharges = [];
let clientSelectionneId = null;

function afficherMessage(texte, estErreur = true) {
  messageGlobal.textContent = texte;
  messageGlobal.style.color = estErreur ? "#dc2626" : "#16a34a";
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

async function chargerClients() {
  const reponse = await fetch(`${API_BASE}/admin/clients`, { headers: enTetesAuth });

  if (reponse.status === 401 || reponse.status === 403) {
    // Soit le token a expiré, soit ce n'est pas un compte agent
    afficherMessage("Accès refusé : cette page est réservée aux agents MTN.");
    setTimeout(() => (window.location.href = "dashboard.html"), 2000);
    return;
  }

  clientsCharges = await reponse.json();
  afficherListeClients(clientsCharges);
}

function afficherListeClients(clients) {
  if (clients.length === 0) {
    listeClients.innerHTML = `<p class="texte-vide">Aucun client trouvé.</p>`;
    return;
  }

  listeClients.innerHTML = clients
    .map(
      (client) => `
      <div class="ligne-client" data-client-id="${client.id}">
        <div>
          <div class="ligne-client-nom">${client.nom} ${client.bloque ? '<span class="badge-bloque">Bloqué</span>' : ""}</div>
          <div class="ligne-client-email">${client.email}</div>
        </div>
        <div class="ligne-client-info">
          <span>${formaterFCFA(client.solde)}</span>
          <span class="ligne-client-forfait">${client.forfaitActif || "Aucun forfait"}</span>
        </div>
      </div>
    `
    )
    .join("");

  document.querySelectorAll(".ligne-client").forEach((ligne) => {
    ligne.addEventListener("click", () => afficherDetailClient(ligne.dataset.clientId));
  });
}

let forfaitsDisponibles = [];

async function chargerForfaitsDisponibles() {
  const reponse = await fetch(`${API_BASE}/client/forfaits`, { headers: enTetesAuth });
  forfaitsDisponibles = await reponse.json();
}

document.getElementById("rechercheClient").addEventListener("input", (evenement) => {
  const recherche = evenement.target.value.toLowerCase();
  const filtres = clientsCharges.filter(
    (client) =>
      client.nom.toLowerCase().includes(recherche) ||
      client.email.toLowerCase().includes(recherche)
  );
  afficherListeClients(filtres);
});

async function afficherDetailClient(clientId) {
  const reponse = await fetch(`${API_BASE}/admin/clients/${clientId}`, { headers: enTetesAuth });
  const client = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(client.message || "Erreur lors du chargement du client.");
    return;
  }

  clientSelectionneId = client.id;
  carteDetailClient.classList.remove("cache");
  titreDetailClient.textContent = `Détail — ${client.nom}`;

  detailClientConteneur.innerHTML = `
    <p class="info-lecture-seule">Email : <strong>${client.email}</strong></p>
    <p class="info-lecture-seule">Solde actuel : <strong>${formaterFCFA(client.solde)}</strong></p>
    <p class="info-lecture-seule">Forfait actif : <strong>${client.forfaitActif ? client.forfaitActif.nom : "Aucun"}</strong></p>
    <p class="info-lecture-seule">Statut : <strong>${client.bloque ? "Compte bloqué" : "Compte actif"}</strong></p>
  `;

  const btnBloquer = document.getElementById("btnBloquerClient");
  btnBloquer.textContent = client.bloque ? "Débloquer ce compte" : "Bloquer ce compte";
  btnBloquer.classList.toggle("bouton-avertissement", !client.bloque);
  btnBloquer.classList.toggle("bouton-succes", !!client.bloque);

  if (forfaitsDisponibles.length === 0) {
    await chargerForfaitsDisponibles();
  }

  document.getElementById("listeForfaitsAgent").innerHTML = forfaitsDisponibles
    .map(
      (forfait) => `
      <div class="carte-forfait">
        <h3>${forfait.nom}</h3>
        <p class="prix">${formaterFCFA(forfait.prix)}</p>
        <ul>
          <li>${forfait.dataMo} Mo de data</li>
          <li>${forfait.appelsMin} min d'appel</li>
          <li>${forfait.sms} SMS</li>
        </ul>
        <button class="bouton-principal" data-attribuer-forfait-id="${forfait.id}">Attribuer</button>
      </div>
    `
    )
    .join("");

  document.querySelectorAll("[data-attribuer-forfait-id]").forEach((bouton) => {
    bouton.addEventListener("click", () => attribuerForfait(bouton.dataset.attribuerForfaitId));
  });

  const classePastilleParType = {
    achat_forfait: "pastille-achat",
    recharge: "pastille-recharge",
    consommation: "pastille-consommation",
    creation_compte: "pastille-compte",
  };

  listeHistoriqueClient.innerHTML = client.historique
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

  carteDetailClient.scrollIntoView({ behavior: "smooth" });
}

async function attribuerForfait(forfaitId) {
  if (!clientSelectionneId) return;

  const reponse = await fetch(`${API_BASE}/admin/clients/${clientSelectionneId}/achat-forfait`, {
    method: "POST",
    headers: enTetesAuth,
    body: JSON.stringify({ forfaitId }),
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors de l'attribution du forfait.");
    return;
  }

  afficherMessage("Forfait attribué avec succès !", false);
  await Promise.all([chargerClients(), afficherDetailClient(clientSelectionneId)]);
}

document.getElementById("btnBloquerClient").addEventListener("click", async () => {
  if (!clientSelectionneId) return;

  const reponse = await fetch(`${API_BASE}/admin/clients/${clientSelectionneId}/bloquer`, {
    method: "POST",
    headers: enTetesAuth,
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors du changement de statut.");
    return;
  }

  afficherMessage(donnees.message, false);
  await Promise.all([chargerClients(), afficherDetailClient(clientSelectionneId)]);
});

document.getElementById("btnSupprimerClient").addEventListener("click", async () => {
  if (!clientSelectionneId) return;

  const confirmation = confirm(
    "Voulez-vous vraiment supprimer définitivement ce compte client ? Cette action est irréversible."
  );

  if (!confirmation) return;

  const reponse = await fetch(`${API_BASE}/admin/clients/${clientSelectionneId}`, {
    method: "DELETE",
    headers: enTetesAuth,
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors de la suppression.");
    return;
  }

  afficherMessage("Compte supprimé avec succès.", false);
  carteDetailClient.classList.add("cache");
  clientSelectionneId = null;
  await chargerClients();
});

document.getElementById("btnRechargeAgent").addEventListener("click", async () => {
  if (!clientSelectionneId) return;

  const champMontant = document.getElementById("montantRechargeAgent");
  const montant = Number(champMontant.value);

  if (!montant || montant <= 0) {
    afficherMessage("Veuillez saisir un montant valide.");
    return;
  }

  const reponse = await fetch(`${API_BASE}/admin/clients/${clientSelectionneId}/recharger`, {
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
  await Promise.all([chargerClients(), afficherDetailClient(clientSelectionneId)]);
});

document.getElementById("btnDeconnexion").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

chargerClients();
