/* Fonction de navigation - Retour direct à l'accueil */
function goBack() {
  window.location.href = "./index.html";
}

let map = null; // Variable globale pour la carte
let signalements = [];
const DRC_CENTER = [-2.8797, 23.656];
const DRC_DEFAULT_ZOOM = 6;
const SIGNAL_VIEW_ZOOM = 18;

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

let currentFilter = null;
let markers = [];

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

function normalizeSignalement(sig) {
  const s = sig || {};
  return {
    ...s,
    type: s.type ? String(s.type).toLowerCase() : "",
    user_nom: s.user_nom || s.userName || s.nom || "Utilisateur local",
  };
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialiser le menu burger
  initMenuBurger();

  // Initialiser le bouton retour
  const btn = document.getElementById("btn-retour");
  if (btn && !btn._backInstalled) {
    btn.addEventListener("click", goBack);
    btn._backInstalled = true;
  }

  // Initialiser le filtre à null (afficher tous)
  currentFilter = null;
  const af = document.getElementById("activeFilter");
  if (af) af.textContent = "Tous";

  // Initialiser la carte avec gestion du global signalements
  signalements = JSON.parse(localStorage.getItem("signalements") || "[]");
  initMap();
  loadAndDisplaySignalements();
  renderSignalementsList();
  updateCounters();

  // Ajouter les écouteurs de filtrage
  addFilterListeners();

  // Ajouter l'écouteur pour le bouton "Afficher tous"
  const btnShowAll = document.getElementById("btn-show-all");
  if (btnShowAll) {
    btnShowAll.addEventListener("click", () => {
      console.log("Bouton 'Afficher tous' cliqué");
      setFilter(null);
    });
  }
});

/**
 * Initialise la carte Leaflet
 */
function initMap() {
  try {
    // Créer la carte centrée sur la RDC
    map = L.map("map").setView(DRC_CENTER, DRC_DEFAULT_ZOOM);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
  } catch (e) {
    console.error("Erreur lors de l'initialisation de la carte:", e);
  }
}

/**
 * Charge et affiche les signalements sur la carte
 */
async function loadAndDisplaySignalements() {
  let backendSignalements = [];

  // récupérer les signalements depuis le backend
  try {
    const resp = await fetch("/backend/api/signaler.php");
    if (resp.ok) {
      const rows = await resp.json();
      backendSignalements = Array.isArray(rows) ? rows : [];
    } else {
      console.error(
        "Erreur HTTP lors du chargement des signalements",
        resp.status,
      );
      backendSignalements = [];
    }
  } catch (err) {
    console.error("Erreur réseau lors du chargement des signalements", err);
    backendSignalements = [];
  }

  const localSignalements = JSON.parse(
    localStorage.getItem("signalements") || "[]",
  );

  signalements = mergeUniqueByKey(
    (Array.isArray(backendSignalements) ? backendSignalements : []).map(
      normalizeSignalement,
    ),
    (Array.isArray(localSignalements) ? localSignalements : []).map(
      normalizeSignalement,
    ),
    (s) =>
      String(
        s?.id ||
          s?.timestamp ||
          `${s?.titre || ""}-${s?.lat || ""}-${s?.lng || ""}`,
      ),
  );

  // Nettoyer les marqueurs existants
  markers.forEach((m) => {
    try {
      map.removeLayer(m);
    } catch (e) {}
  });
  markers = [];

  // Ajouter les marqueurs pour chaque signalement
  signalements.forEach((sig) => {
    addMarkerToMap(sig);
  });

  // Afficher la liste des signalements
  renderSignalementsList();

  // Mettre à jour les compteurs
  updateCounters();
}

/**
 * Ajoute un marqueur à la carte
 */
function addMarkerToMap(sig) {
  if (!map || sig.lat == null || sig.lng == null) return;

  const icon = getIconForType(sig.type);
  const opts = {};
  if (sig.adresseTrouvee === false) {
    opts.opacity = 0.6;
  }
  const m = icon
    ? L.marker([sig.lat, sig.lng], Object.assign({ icon: icon }, opts)).addTo(
        map,
      )
    : L.marker([sig.lat, sig.lng], opts).addTo(map);

  // Créer le contenu du popup
  let popupContent = '<div class="carte-signalement popup-signalement">';
  if (sig.adresseTrouvee === false) {
    popupContent +=
      '<div style="color:#b22222;font-weight:bold;margin-bottom:6px;">Adresse non vérifiée</div>';
  }
  if (sig.photo) {
    popupContent +=
      '<img src="' +
      sig.photo +
      '" alt="' +
      (sig.titre || "Signalement") +
      '" class="carte-signalement-photo">';
  }
  popupContent += "<h3>" + (sig.titre || "Signalement") + "</h3>";
  popupContent +=
    '<p class="carte-signalement-desc">' + (sig.description || "") + "</p>";
  popupContent +=
    '<div class="carte-signalement-author">Par : ' +
    (sig.user_nom || "Utilisateur local") +
    "</div>";
  if (sig.type)
    popupContent +=
      '<span class="carte-signalement-type">' + sig.type + "</span>";
  if (sig.timestamp) {
    try {
      const dateStr = new Date(sig.timestamp).toLocaleString("fr-FR");
      popupContent +=
        '<div class="carte-signalement-meta">' + dateStr + "</div>";
    } catch (e) {}
  }
  popupContent += "</div>";

  m.bindPopup(popupContent);
  m._sigType = (sig.type || "").toLowerCase();
  m._sigTimestamp = sig.timestamp;
  m._sigLat = sig.lat;
  m._sigLng = sig.lng;
  markers.push(m);
}

function findMarkerForSignalement(sig) {
  if (!sig) return null;

  let marker = null;
  if (sig.timestamp) {
    marker = markers.find((m) => m._sigTimestamp === sig.timestamp) || null;
  }

  if (!marker && sig.lat != null && sig.lng != null) {
    marker =
      markers.find(
        (m) =>
          Math.abs(Number(m._sigLat) - Number(sig.lat)) < 0.000001 &&
          Math.abs(Number(m._sigLng) - Number(sig.lng)) < 0.000001,
      ) || null;
  }

  return marker;
}

function focusSignalementOnMap(sig) {
  if (!map || !sig || sig.lat == null || sig.lng == null) return;

  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const marker = findMarkerForSignalement(sig);

  window.setTimeout(() => {
    try {
      map.invalidateSize();
    } catch (e) {}

    if (marker && !map.hasLayer(marker)) {
      try {
        map.addLayer(marker);
      } catch (e) {}
    }

    map.flyTo([sig.lat, sig.lng], SIGNAL_VIEW_ZOOM, { duration: 1.1 });
  }, 250);

  if (marker) {
    window.setTimeout(() => {
      try {
        marker.openPopup();
      } catch (e) {}
    }, 700);
  }
}

/**
 * Obtient l'icône appropriée selon le type
 */
function getIconForType(typeValue) {
  const iconBasePath = "/icon-map/";

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

  if (!config) {
    console.warn("Icon not found for type:", typeValue, "normalized:", key);
    return null;
  }

  const size = config.size;
  return L.icon({
    iconUrl: config.url,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  });
}

/**
 * Ajoute les écouteurs pour les icônes de filtrage
 */
function addFilterListeners() {
  document.querySelectorAll(".filter-icon").forEach((img) => {
    img.addEventListener("click", () => {
      const type = img.dataset.type;
      if (!type) return;

      if (currentFilter === type.toLowerCase()) {
        setFilter(null);
      } else {
        setFilter(type);
      }
    });
  });
}

/**
 * Définit le filtre courant
 */
function setFilter(type) {
  currentFilter = type ? String(type).toLowerCase() : null;
  console.log(
    "setFilter appelé avec:",
    type,
    "currentFilter est maintenant:",
    currentFilter,
  );

  // Mettre à jour l'affichage du filtre actif
  const af = document.getElementById("activeFilter");
  if (af) {
    af.textContent = currentFilter ? currentFilter : "Tous";
    console.log("activeFilter mis à jour à:", af.textContent);
  }

  // Mettre en évidence les icônes de filtre
  document.querySelectorAll(".filter-icon").forEach((img) => {
    const isActive =
      currentFilter &&
      img.dataset.type &&
      img.dataset.type.toLowerCase() === currentFilter;
    img.classList.toggle("active-filter", isActive);
  });

  // Mettre à jour la visibilité des marqueurs
  updateMarkersVisibility();

  // Rafraîchir la liste
  renderSignalementsList();

  // Mettre à jour les compteurs
  updateCounters();
}

/**
 * Met à jour la visibilité des marqueurs selon le filtre
 */
function updateMarkersVisibility() {
  markers.forEach((m) => {
    const t = String(m._sigType || "").toLowerCase();
    const show = !currentFilter || t === currentFilter;

    try {
      if (show && !map.hasLayer(m)) {
        map.addLayer(m);
      } else if (!show && map.hasLayer(m)) {
        map.removeLayer(m);
      }
    } catch (e) {}
  });
}

/**
 * Affiche la liste des signalements
 */
function renderSignalementsList() {
  const container = document.getElementById("listeSignalements");
  if (!container) return;

  container.innerHTML = "";

  const filtered = signalements.filter(
    (s) => !currentFilter || (s.type && s.type.toLowerCase() === currentFilter),
  );

  if (filtered.length === 0) {
    container.innerHTML =
      '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Aucun signalement.</p>';
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach((sig) => {
    const card = document.createElement("div");
    card.className = "carte-signalement";
    card.dataset.ts = sig.timestamp;
    if (!sig.photo) {
      card.classList.add("no-photo");
    }

    if (sig.photo) {
      const img = document.createElement("img");
      img.src = sig.photo;
      img.alt = sig.titre;
      img.className = "carte-signalement-photo";
      card.appendChild(img);
    }

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

    const author = document.createElement("p");
    author.className = "carte-signalement-author";
    author.textContent = "Par : " + (sig.user_nom || "Utilisateur local");
    card.appendChild(author);

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
      focusSignalementOnMap(sig);
    });

    btnContainer.appendChild(btnVoirCarte);
    card.appendChild(btnContainer);

    frag.appendChild(card);
  });

  container.appendChild(frag);
}

/**
 * Met à jour les compteurs
 */
function updateCounters() {
  const totalEl = document.getElementById("totalSignalements");
  if (totalEl) {
    totalEl.textContent = String(signalements.length || 0);
  }

  const filteredCountEl = document.getElementById(
    "totalSignalementsAfficheAll",
  );
  if (filteredCountEl) {
    const filtered = signalements.filter(
      (s) =>
        !currentFilter || (s.type && s.type.toLowerCase() === currentFilter),
    );
    filteredCountEl.textContent = String(filtered.length || 0);
  }
}
