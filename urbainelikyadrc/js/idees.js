/* IDEES.JS - VERSION SIMPLE (stockage local) */

let idees = JSON.parse(localStorage.getItem("idees_page") || "[]"); // Donnees de la page Idees

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  // Affiche les idées déjà sauvegardées au chargement.
  renderIdees();

  const form = document.getElementById("formIdee");
  if (form) form.addEventListener("submit", addIdee);

  const btnVider = document.getElementById("btnViderIdees");
  if (btnVider) btnVider.addEventListener("click", clearIdees);
});

function addIdee(e) {
  e.preventDefault();
  // Lire les informations du formulaire.
  const titre = document.getElementById("titre").value.trim();
  const categorie = document.getElementById("categorie").value;
  const desc = document.getElementById("description").value.trim();

  if (!titre || !desc) {
    alert("Titre et description requis");
    return;
  }

  const idee = {
    titre,
    categorie,
    description: desc,
    likes: 0,
    timestamp: new Date().toISOString(),
  };
  // Ajouter en haut de liste puis sauvegarder en local.
  idees.unshift(idee);
  localStorage.setItem("idees_page", JSON.stringify(idees));
  renderIdees();
  e.target.reset();
  alert("Idée ajoutée !");
}

function renderIdees() {
  const container = document.getElementById("listeIdees");
  if (container) {
    // Génère les cartes HTML de toutes les idées.
    container.innerHTML =
      idees
        .map(
          (idee, index) => `
      <div class="carte-idee">
        <h3>${idee.titre}</h3>
        <p>${idee.description}</p>
        <span class="categorie-badge">${idee.categorie}</span>
        <small>${new Date(idee.timestamp).toLocaleString()}</small>
        <div class="carte-actions">
          <button class="btn-delete" onclick="deleteIdee('${idee.timestamp}')">Supprimer</button>
        </div>
      </div>
    `,
        )
        .join("") || "<p>Aucune idée.</p>";
  }

  const totalEl = document.getElementById("totalIdees");
  if (totalEl) totalEl.textContent = idees.length;
}

function likeIdee(index) {
  if (index >= 0 && index < idees.length) {
    idees[index].likes = (idees[index].likes || 0) + 1;
    localStorage.setItem("idees_page", JSON.stringify(idees));
    renderIdees();
  }
}

function deleteIdee(timestamp) {
  // Supprime uniquement l'idée correspondant au timestamp choisi.
  if (confirm("Supprimer ?")) {
    idees = idees.filter((i) => i.timestamp !== timestamp);
    localStorage.setItem("idees_page", JSON.stringify(idees));
    renderIdees();
  }
}

function clearIdees() {
  // Vide totalement la liste et le stockage local.
  if (confirm("Vider toutes les idées ?")) {
    idees = [];
    localStorage.removeItem("idees_page");
    renderIdees();
  }
}
