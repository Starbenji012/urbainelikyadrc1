/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");

  if (menuBurger && navigationMenu) {
    menuBurger.addEventListener("click", () => {
      navigationMenu.classList.toggle("active");
    });

    // Fermer le menu quand un lien est cliqué
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigationMenu.classList.remove("active");
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  // Initialiser le menu burger
  initMenuBurger();

  // Afficher les signalements
  displaySignalements();
  // Afficher les idées
  await displayIdees();
});

/**
 * Affiche tous les signalements sous forme de cartes
 */
async function displaySignalements() {
  let signalements = [];
  try {
    const response = await fetch("/backend/api/signaler.php", {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Erreur HTTP " + response.status);
    }
    signalements = await response.json();
  } catch (error) {
    console.error("Erreur réseau:", error);
    signalements = [];
  }

  const container = document.querySelector(".signalements-container");

  if (!container) return;

  // Vider le conteneur
  container.innerHTML = "";

  // Si pas de signalements
  if (signalements.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Aucun signalement pour le moment. <a href="signaler.html" style="color: #0f2145; font-weight: bold;">Soyez le premier à signaler !</a></p>';
    return;
  }

  // Créer les cartes de signalements
  const fragment = document.createDocumentFragment();
  signalements.forEach((signalement, index) => {
    const card = document.createElement("div");
    card.className = "carte-signalement";

    // Ajouter la photo si elle existe
    let photoHtml = "";
    if (signalement.photo) {
      photoHtml = `<img src="${signalement.photo}" alt="${signalement.titre}" class="carte-photo">`;
    }

    // Créer le badge de statut
    const etat = signalement.etat || "en_cours";
    const badgeColor = etat === "resolus" ? "#248154" : "#f4a261";
    const badgeText = etat === "resolus" ? "Résolu" : "En cours";

    card.innerHTML = `
            ${photoHtml}
            <div class="carte-content">
                <h3>${signalement.titre || "Sans titre"}</h3>
                <p class="description">${signalement.description || ""}</p>
                <div class="carte-meta">
                    <span class="type" style="background-color: #e0e0e0; color: #333;">${signalement.type || "Non spécifié"}</span>
                    <span class="status" style="background-color: ${badgeColor}; color: white;">${badgeText}</span>
                </div>
                <div class="carte-footer">
                    <small>${signalement.lieu || "Localisation non spécifiée"}</small>
                </div>
            </div>
        `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);
}

/**
 * Affiche toutes les idées sous forme de cartes
 */
async function displayIdees() {
  let idees = [];
  try {
    const response = await fetch("/backend/api/idees.php");
    if (!response.ok) {
      throw new Error("Erreur HTTP " + response.status);
    }
    idees = await response.json();
  } catch (error) {
    console.error("Erreur réseau:", error);
    idees = [];
  }

  const container = document.querySelector(".idees-container");

  if (!container) return;

  // Vider le conteneur
  container.innerHTML = "";

  // Si pas d'idées
  if (idees.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Aucune idée pour le moment. <a href="idees.html" style="color: #0f2145; font-weight: bold;">Soyez le premier à proposer une idée !</a></p>';
    return;
  }

  // Créer les cartes d\'idées
  const fragment = document.createDocumentFragment();
  idees.forEach((idee) => {
    const card = document.createElement("div");
    card.className = "carte-idee";

    // Ajouter la photo si elle existe
    let photoHtml = "";
    if (idee.photo) {
      photoHtml = `<img src="${idee.photo}" alt="${idee.titre}" class="carte-photo">`;
    }

    card.innerHTML = `
            ${photoHtml}
            <div class="carte-content">
                <h3>${idee.titre || "Sans titre"}</h3>
                <p class="description">${idee.description || ""}</p>
                <div class="carte-meta">
                    <span class="categorie" style="background-color: #e0e0e0; color: #333;">${idee.categorie || "Non catégorisée"}</span>
                </div>
                <div class="carte-footer">
                    <button class="btn-like" data-id="${idee.id}" style="background: none; border: none; cursor: pointer; font-size: 1.1rem;">❤️ <span class="likes-count">${idee.likes || 0}</span></button>
                </div>
            </div>
        `;

    fragment.appendChild(card);
  });

  container.appendChild(fragment);

  // Ajouter les event listeners pour les boutons like
  container.addEventListener("click", async (e) => {
    if (
      e.target.classList.contains("btn-like") ||
      e.target.closest(".btn-like")
    ) {
      const btn = e.target.classList.contains("btn-like")
        ? e.target
        : e.target.closest(".btn-like");
      const id = parseInt(btn.dataset.id);
      if (!isNaN(id)) {
        try {
          const response = await fetch("/backend/api/idees.php", {
            credentials: "include",
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "like", id: id }),
          });
          if (!response.ok) {
            throw new Error("Erreur HTTP " + response.status);
          }
          const data = await response.json();
          if (data.success) {
            // Recharger les idées pour mettre à jour les likes
            displayIdees();
          } else {
            console.error("Erreur lors du like:", data.error);
          }
        } catch (error) {
          console.error("Erreur réseau:", error);
        }
      }
    }
  });
}
