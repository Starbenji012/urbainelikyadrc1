/* IDEES.JS - VERSION INITIALE BASIQUE (localStorage) */

/* GESTION MENU BURGER */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");
  if (menuBurger && navigationMenu) {
    menuBurger.addEventListener("click", () => {
      navigationMenu.classList.toggle("mobile-active");
    });
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () =>
        navigationMenu.classList.remove("mobile-active"),
      );
    });
  }
}

let idees = JSON.parse(localStorage.getItem("idees_page") || "[]"); // VERSION PAGE IDÉES

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  renderIdees();

  const form = document.getElementById("formIdee");
  if (form) form.addEventListener("submit", addIdee);

  const btnVider = document.getElementById("btnViderIdees");
  if (btnVider) btnVider.addEventListener("click", clearIdees);
});

function addIdee(e) {
  e.preventDefault();
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
  idees.unshift(idee);
  localStorage.setItem("idees_page", JSON.stringify(idees));
  renderIdees();
  e.target.reset();
  alert("Idée ajoutée !");
}

function renderIdees() {
  const container = document.getElementById("listeIdees");
  if (container) {
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
  if (confirm("Supprimer ?")) {
    idees = idees.filter((i) => i.timestamp !== timestamp);
    localStorage.setItem("idees_page", JSON.stringify(idees));
    renderIdees();
  }
}

function clearIdees() {
  if (confirm("Vider toutes les idées ?")) {
    idees = [];
    localStorage.removeItem("idees_page");
    renderIdees();
  }
}
