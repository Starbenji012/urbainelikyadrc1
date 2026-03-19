/* SIGNALEMENT.JS - VERSION INITIALE BASIQUE (localStorage, sans backend/géocodage) */

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");

  if (menuBurger && navigationMenu) {
    menuBurger.addEventListener("click", () => {
      navigationMenu.classList.toggle("mobile-active");
    });

    // Fermer le menu quand un lien est cliqué
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigationMenu.classList.remove("mobile-active");
      });
    });
  }
}

let map;
let markers = [];
let signalements = [];

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  // Charger signalements depuis localStorage
  const saved = localStorage.getItem("signalements");
  if (saved) {
    signalements = JSON.parse(saved);
  }

  initMap();
  renderList();
  renderMap();

  // Form submit
  const form = document.getElementById("form-signalement");
  if (form) {
    form.addEventListener("submit", addSignalement);
  }

  // Clear all
  const btnVider = document.getElementById("btnViderSignalements");
  if (btnVider) {
    btnVider.addEventListener("click", clearSignalements);
  }

  updateTotalSignalements();
});

function initMap() {
  map = L.map("map").setView([-4.0383, 15.3267], 10); // Kinshasa
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // Click to set location
  map.on("click", function (e) {
    document.getElementById("lieu").value =
      `${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)}`;
  });

  renderMap();
}

function addSignalement(e) {
  e.preventDefault();
  const titre = document.getElementById("titre-probleme").value.trim();
  const type = document.getElementById("type-probleme").value;
  const desc = document.getElementById("description").value.trim();
  const lieu = document.getElementById("lieu").value.trim();

  if (!titre || !desc) {
    alert("Titre et description requis");
    return;
  }

  const latLng = lieu.match(/([-+]?\d+\.?\d*),?\s*([-+]?\d+\.?\d*)/);
  const lat = latLng ? parseFloat(latLng[1]) : -4.0383;
  const lng = latLng ? parseFloat(latLng[2]) : 15.3267;

  const sig = {
    titre,
    type,
    description: desc,
    lieu,
    lat,
    lng,
    timestamp: new Date().toISOString(),
  };

  signalements.unshift(sig); // Add to front
  localStorage.setItem("signalements", JSON.stringify(signalements));

  renderList();
  renderMap();
  updateTotalSignalements();

  // Centrer la carte sur le nouveau signalement
  if (map) {
    map.flyTo([lat, lng], 16, { duration: 1.2 });
  }

  e.target.reset();
  document.getElementById("lieu").value = "";
  alert("Signalement ajouté !");
}

function renderList() {
  const container = document.getElementById("listeSignalements");
  if (!container) return;

  container.innerHTML = "";

  if (signalements.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Aucun signalement.</p>';
    return;
  }

  const frag = document.createDocumentFragment();

  signalements.forEach((sig) => {
    const card = document.createElement("div");
    card.className = "carte-signalement";
    card.dataset.ts = sig.timestamp;

    const h3 = document.createElement("h3");
    h3.textContent = sig.titre;
    card.appendChild(h3);

    const desc = document.createElement("p");
    desc.className = "carte-signalement-desc";
    desc.textContent = sig.description;
    card.appendChild(desc);

    if (sig.type) {
      const type = document.createElement("span");
      type.className = "carte-signalement-type";
      type.textContent = sig.type.charAt(0).toUpperCase() + sig.type.slice(1);
      card.appendChild(type);
    }

    const location = document.createElement("p");
    location.className = "carte-signalement-location";
    location.textContent = "📍 " + (sig.lieu || "Adresse non spécifiée");
    card.appendChild(location);

    const meta = document.createElement("div");
    meta.className = "carte-signalement-meta";
    if (sig.timestamp) {
      try {
        const dt = new Date(sig.timestamp).toLocaleString("fr-FR");
        meta.textContent = dt;
      } catch (e) {
        meta.textContent = "Date inconnue";
      }
    }
    card.appendChild(meta);

    const btnContainer = document.createElement("div");
    btnContainer.className = "carte-signalement-buttons";

    const btnVoirCarte = document.createElement("button");
    btnVoirCarte.type = "button";
    btnVoirCarte.className = "btn-voir-carte";
    btnVoirCarte.textContent = "Voir sur carte";
    btnVoirCarte.addEventListener("click", () => {
      if (map) {
        map.flyTo([sig.lat, sig.lng], 16, { duration: 1.2 });
      }
    });

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn-delete-signalement";
    btnDelete.textContent = "Supprimer";
    btnDelete.addEventListener("click", () => {
      deleteSignalement(sig.timestamp);
    });

    btnContainer.appendChild(btnVoirCarte);
    btnContainer.appendChild(btnDelete);
    card.appendChild(btnContainer);

    frag.appendChild(card);
  });

  container.appendChild(frag);
}

function renderMap() {
  // Clear existing markers
  markers.forEach((m) => map.removeLayer(m));
  markers = [];

  signalements.forEach((sig) => {
    const icon = getIconForType(sig.type);
    const markerOptions = icon ? { icon: icon } : {};
    const marker = L.marker([sig.lat, sig.lng], markerOptions).addTo(map)
      .bindPopup(`
        <b>${sig.titre}</b><br>
        <strong>${sig.type}</strong><br>
        ${sig.description}<br>
        📍 ${sig.lieu}
      `);
    markers.push(marker);
  });
}

function deleteSignalement(timestamp) {
  if (confirm("Supprimer ce signalement ?")) {
    signalements = signalements.filter((s) => s.timestamp !== timestamp);
    localStorage.setItem("signalements", JSON.stringify(signalements));
    renderList();
    renderMap();
    updateTotalSignalements();
  }
}

function clearSignalements() {
  if (confirm("Vider tous les signalements ?")) {
    signalements = [];
    localStorage.removeItem("signalements");
    renderList();
    renderMap();
    updateTotalSignalements();
  }
}

function updateTotalSignalements() {
  const el = document.getElementById("totalSignalements");
  if (el) el.textContent = signalements.length;
  const elAll = document.getElementById("totalSignalementsAfficheAll");
  if (elAll) elAll.textContent = signalements.length;
}

/**
 * Obtient l'icône appropriée selon le type
 */
function getIconForType(typeValue) {
  const iconBasePath = "../icon-map/";

  const icons = {
    voirie: { url: iconBasePath + "icons8-route-48.png", size: [48, 48] },
    eau: { url: iconBasePath + "icons8-eau-48.png", size: [48, 48] },
    electricite: {
      url: iconBasePath + "icons8-électricité-32.png",
      size: [32, 32],
    },
    insecurite: {
      url: iconBasePath + "icons8-protection-du-trou-de-serrure-48.png",
      size: [48, 48],
    },
    dechet: { url: iconBasePath + "icons8-corbeille-48.png", size: [48, 48] },
  };

  const key = (typeValue || "").toLowerCase();
  const config = icons[key];

  if (!config) return null;

  const size = config.size;
  return L.icon({
    iconUrl: config.url,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  });
}
