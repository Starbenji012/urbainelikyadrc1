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

function readLocalArray(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

async function fetchArray(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) {
    return [];
  }
}

function mergeUniqueByKey(arrA, arrB, keyFn) {
  const out = [];
  const seen = new Set();
  [...arrA, ...arrB].forEach((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(item);
  });
  return out;
}

async function updateGlobalStats() {
  const localSignalements = readLocalArray("signalements");
  const backendSignalements = await fetchArray("/backend/api/signaler.php");
  const allSignalements = mergeUniqueByKey(
    backendSignalements,
    localSignalements,
    (s) =>
      String(
        s?.id ||
          s?.timestamp ||
          `${s?.titre || ""}-${s?.lat || ""}-${s?.lng || ""}`,
      ),
  );

  const localIdees = readLocalArray("idees_page");
  const backendIdees = await fetchArray("/backend/api/idees.php");
  const allIdees = mergeUniqueByKey(backendIdees, localIdees, (i) =>
    String(i?.id || i?.timestamp || i?.titre || ""),
  );

  const sigEl = document.getElementById("sig-total");
  if (sigEl) sigEl.textContent = String(allSignalements.length);

  const ideesEl = document.getElementById("idees-soumis");
  if (ideesEl) ideesEl.textContent = String(allIdees.length);
}

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  updateGlobalStats();

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
