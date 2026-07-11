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

function afficherMessage(texte, estErreur = true) {
  messageGlobal.textContent = texte;
  messageGlobal.style.color = estErreur ? "#dc2626" : "#16a34a";
  setTimeout(() => (messageGlobal.textContent = ""), 4000);
}

const libellesRole = {
  client: "Client",
  agent: "Agent MTN",
};

async function chargerProfil() {
  const reponse = await fetch(`${API_BASE}/client/profile`, { headers: enTetesAuth });

  if (reponse.status === 401 || reponse.status === 403) {
    localStorage.clear();
    window.location.href = "index.html";
    return;
  }

  const utilisateur = await reponse.json();
  document.getElementById("emailProfil").textContent = utilisateur.email;
  document.getElementById("roleProfil").textContent = libellesRole[utilisateur.role] || "Client";
  document.getElementById("nomProfil").value = utilisateur.nom;
}

document.getElementById("formNom").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const nom = document.getElementById("nomProfil").value.trim();

  const reponse = await fetch(`${API_BASE}/client/profile`, {
    method: "PUT",
    headers: enTetesAuth,
    body: JSON.stringify({ nom }),
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors de la mise à jour.");
    return;
  }

  afficherMessage("Nom mis à jour avec succès !", false);
});

document.getElementById("formMotDePasse").addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const ancienMotDePasse = document.getElementById("ancienMotDePasse").value;
  const nouveauMotDePasse = document.getElementById("nouveauMotDePasse").value;

  const reponse = await fetch(`${API_BASE}/client/profile`, {
    method: "PUT",
    headers: enTetesAuth,
    body: JSON.stringify({ ancienMotDePasse, nouveauMotDePasse }),
  });

  const donnees = await reponse.json();

  if (!reponse.ok) {
    afficherMessage(donnees.message || "Erreur lors du changement de mot de passe.");
    return;
  }

  afficherMessage("Mot de passe changé avec succès !", false);
  document.getElementById("formMotDePasse").reset();
});

document.getElementById("btnDeconnexion").addEventListener("click", () => {
  localStorage.clear();
  window.location.href = "index.html";
});

chargerProfil();
