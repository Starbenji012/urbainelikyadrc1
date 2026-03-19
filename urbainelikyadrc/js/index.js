/* INDEX.JS - VERSION CORRIGÉE */

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

// Gestion des témoignages
let temoignages = JSON.parse(localStorage.getItem("temoignages") || "[]");

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  // Static stats
  document.getElementById("sig-total") &&
    (document.getElementById("sig-total").textContent = "12");
  document.getElementById("sig-en-cours") &&
    (document.getElementById("sig-en-cours").textContent = "8");
  document.getElementById("sig-resolus") &&
    (document.getElementById("sig-resolus").textContent = "4");
  document.getElementById("idees-soumis") &&
    (document.getElementById("idees-soumis").textContent = "5");

  // Temoignages - affichage initial
  renderTemoignages();

  // Event listeners pour boutons du formulaire
  const btnAddTemoignage = document.getElementById("btn-add-temoignage");
  const btnCancelTemoignage = document.getElementById("btn-cancel-temoignage");
  const formTemoignage = document.getElementById("form-temoignage");

  if (btnAddTemoignage) {
    btnAddTemoignage.addEventListener("click", () => {
      formTemoignage.style.display =
        formTemoignage.style.display === "none" ? "block" : "none";
    });
  }

  if (btnCancelTemoignage) {
    btnCancelTemoignage.addEventListener("click", () => {
      formTemoignage.style.display = "none";
      formTemoignage.reset();
    });
  }

  if (formTemoignage) {
    formTemoignage.addEventListener("submit", addTemoignage);
  }
});

function addTemoignage(e) {
  e.preventDefault();
  const nom = document.getElementById("temoignage-nom").value.trim();
  const ville = document.getElementById("temoignage-ville").value.trim();
  const message = document.getElementById("temoignage-message").value.trim();

  if (!nom || !ville || !message) {
    alert("Tous les champs obligatoires doivent être remplis");
    return;
  }

  const temoignage = {
    nom,
    ville,
    message,
    timestamp: new Date().toISOString(),
  };

  temoignages.unshift(temoignage);
  localStorage.setItem("temoignages", JSON.stringify(temoignages));
  renderTemoignages();

  const form = document.getElementById("form-temoignage");
  form.style.display = "none";
  form.reset();
  alert("Témoignage ajouté avec succès !");
}

function renderTemoignages() {
  const container = document.querySelector(".temoignages-contenaire");
  if (!container) return;

  // Combiner témoignages stockés + démo
  const demoTemoins = [
    {
      message: "Excellente plateforme pour signaler les problèmes !",
      nom: "Jean K.",
      ville: "Kinshasa",
    },
    {
      message: "J'ai signalé une route abîmée et ça a été réparé !",
      nom: "Marie M.",
      ville: "Lubumbashi",
    },
  ];

  const allTemoins = [...temoignages, ...demoTemoins];

  container.innerHTML = allTemoins
    .map(
      (t) => `
    <div class="temoignages-cards">
      <div class="left-border"></div>
      <div class="content">
        <p>"${t.message}"</p>
        <div class="user-info">
          <h4>${t.nom}</h4>
          <p>${t.ville}</p>
        </div>
      </div>
      <img src="../img/logo.png" alt="user" class="profile-picture">
    </div>
  `,
    )
    .join("");
}
