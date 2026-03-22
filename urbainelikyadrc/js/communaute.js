/* COMMUNAUTE.JS - VERSION MISE A JOUR */

// Donnees locales - page Communaute (likes separes)
let idees = JSON.parse(localStorage.getItem("idees_page") || "[]"); // Lecture depuis idées.js
// Les likes de la communauté sont stockés séparément par timestamp.
let idees_communaute = idees.map((idee) => ({
  ...idee,
  likes:
    JSON.parse(localStorage.getItem("idees_communaute_likes") || "{}")[
      idee.timestamp
    ] || 0,
}));

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  // Afficher les idées dès l'ouverture de la page.
  renderIdees();
});

function renderIdees() {
  const ideesContainer = document.querySelector(".idees-container");
  if (ideesContainer) {
    // Affiche un message vide ou la liste des cartes d'idées.
    ideesContainer.innerHTML =
      idees_communaute.length === 0
        ? "<p>Aucune idée.</p>"
        : idees_communaute
            .map(
              (idee, index) => `
      <div class="carte-idee">
        <h3>${idee.titre}</h3>
        <p>${idee.description}</p>
        <span class="categorie-badge">${idee.categorie}</span>
        <small>${new Date(idee.timestamp).toLocaleString()}</small>
        <div class="carte-actions">
          <button class="btn-like" onclick="communauteLikeIdee('${idee.timestamp}')">
            <i class='bx bx-heart'></i> <span class="like-count">${idee.likes || 0}</span>
          </button>
        </div>
      </div>
    `,
            )
            .join("");
  }
}

function communauteLikeIdee(timestamp) {
  // Incrémente le like pour l'idée ciblée et le sauvegarde.
  const likes = JSON.parse(
    localStorage.getItem("idees_communaute_likes") || "{}",
  );
  likes[timestamp] = (likes[timestamp] || 0) + 1;
  localStorage.setItem("idees_communaute_likes", JSON.stringify(likes));

  // Recalculer la liste avec les nouvelles valeurs puis réafficher.
  idees_communaute = idees.map((idee) => ({
    ...idee,
    likes: likes[idee.timestamp] || 0,
  }));
  renderIdees();
}
