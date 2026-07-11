const API_BASE = "/api";

// Gestion des onglets Connexion / Inscription
const onglets = document.querySelectorAll(".onglet");
const formConnexion = document.getElementById("formConnexion");
const formInscription = document.getElementById("formInscription");

onglets.forEach((onglet) => {
  onglet.addEventListener("click", () => {
    onglets.forEach((o) => o.classList.remove("actif"));
    onglet.classList.add("actif");

    if (onglet.dataset.onglet === "connexion") {
      formConnexion.classList.remove("cache");
      formInscription.classList.add("cache");
    } else {
      formInscription.classList.remove("cache");
      formConnexion.classList.add("cache");
    }
  });
});

// Si un token existe déjà, on redirige directement vers le dashboard
if (localStorage.getItem("token")) {
  window.location.href = "dashboard.html";
}

// --- Connexion ---
formConnexion.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const erreurConnexion = document.getElementById("erreurConnexion");
  erreurConnexion.textContent = "";

  const email = document.getElementById("emailConnexion").value.trim();
  const motDePasse = document.getElementById("motDePasseConnexion").value;

  try {
    const reponse = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, motDePasse }),
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
      erreurConnexion.textContent = donnees.message || "Erreur de connexion.";
      return;
    }

    localStorage.setItem("token", donnees.token);
    localStorage.setItem("utilisateur", JSON.stringify(donnees.utilisateur));
    window.location.href = "dashboard.html";
  } catch (erreur) {
    erreurConnexion.textContent = "Impossible de contacter le serveur. Vérifiez qu'il est bien démarré.";
  }
});

// Affiche/masque le champ code agent
const toggleCodeAgent = document.getElementById("toggleCodeAgent");
const blocCodeAgent = document.getElementById("blocCodeAgent");
toggleCodeAgent.addEventListener("click", () => {
  blocCodeAgent.classList.toggle("cache");
});

// --- Inscription ---
formInscription.addEventListener("submit", async (evenement) => {
  evenement.preventDefault();
  const erreurInscription = document.getElementById("erreurInscription");
  const succesInscription = document.getElementById("succesInscription");
  erreurInscription.textContent = "";
  succesInscription.textContent = "";

  const nom = document.getElementById("nomInscription").value.trim();
  const email = document.getElementById("emailInscription").value.trim();
  const motDePasse = document.getElementById("motDePasseInscription").value;
  const codeAgent = document.getElementById("codeAgentInscription").value.trim();

  try {
    const reponse = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom, email, motDePasse, codeAgent }),
    });

    const donnees = await reponse.json();

    if (!reponse.ok) {
      erreurInscription.textContent = donnees.message || "Erreur lors de l'inscription.";
      return;
    }

    succesInscription.textContent = "Compte créé ! Vous pouvez maintenant vous connecter.";
    formInscription.reset();

    // Bascule automatiquement vers l'onglet connexion après 1.5s
    setTimeout(() => {
      document.querySelector('.onglet[data-onglet="connexion"]').click();
    }, 1500);
  } catch (erreur) {
    erreurInscription.textContent = "Impossible de contacter le serveur. Vérifiez qu'il est bien démarré.";
  }
});
