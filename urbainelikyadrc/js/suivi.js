let map = null; // Variable globale pour la carte
let signalements = [];
let markers = [];

// Endpoints testes dans l'ordre. Si aucun backend ne repond, on bascule en local.
const SIGNALEMENTS_API_ENDPOINTS = [
  "/backend/api/signalements/index.php",
  "../backend/api/signalements/index.php",
  "backend/api/signalements/index.php",
];

let currentFilter = null;

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagee dans utils.js
  initMenuBurger();

  // Initialiser la carte
  initMap();

  // récupérer les signalements depuis le backend
  loadAndDisplaySignalements();

  // Ajouter les écouteurs de filtrage
  addFilterListeners();

  // Ajouter l'écouteur pour le bouton "Afficher tous"
  const btnShowAll = document.getElementById("btn-show-all");
  if (btnShowAll) {
    btnShowAll.addEventListener("click", () => setFilter(null));
  }
});

/**
 * Initialise la carte Leaflet
 */
function initMap() {
  try {
    // Créer la carte centrée sur Kinshasa
    map = L.map("map").setView([-4.0383, 21.7587], 13);
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
  // Recuperer les signalements depuis le backend (avec fallback localStorage).
  try {
    let apiData = null;

    for (const endpoint of SIGNALEMENTS_API_ENDPOINTS) {
      try {
        const resp = await fetch(endpoint, {
          method: "GET",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });

        if (!resp.ok) continue;

        const data = await resp.json();
        if (Array.isArray(data)) {
          apiData = data;
          console.log(`✓ Signalements chargés depuis ${endpoint}:`, data);
          break;
        }
      } catch (endpointError) {
        // On essaie l'endpoint suivant sans interrompre le chargement.
      }
    }

    if (Array.isArray(apiData)) {
      signalements = apiData;
    } else {
      // Fallback: utile quand le backend est indisponible dans l'environnement local.
      signalements = JSON.parse(localStorage.getItem("signalements") || "[]");
      console.warn(
        "Backend indisponible: affichage des signalements depuis localStorage.",
        signalements,
      );
    }
    console.log("Total signalements chargés:", signalements.length);
    console.log(
      "Vérification coords:",
      signalements
        .slice(0, 2)
        .map((s) => ({ titre: s.titre, lat: s.lat, lng: s.lng })),
    );
  } catch (err) {
    console.error("Erreur réseau lors du chargement des signalements", err);
    signalements = JSON.parse(localStorage.getItem("signalements") || "[]");
  }

  // Nettoyer les marqueurs existants
  markers.forEach((m) => {
    try {
      map.removeLayer(m);
    } catch (e) {}
  });
  markers = [];

  // Ajouter les marqueurs pour chaque signalement
  console.log("Création des marqueurs...");
  signalements.forEach((sig) => {
    addMarkerToMap(sig);
  });
  console.log("Marqueurs créés:", markers.length);

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
  if (sig.user_nom) {
    popupContent +=
      '<div class="carte-signalement-author">Par : ' + sig.user_nom + "</div>";
  }
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
  markers.push(m);
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

  // Mettre à jour l'affichage du filtre actif
  const af = document.getElementById("activeFilter");
  if (af) af.textContent = currentFilter ? currentFilter : "Tous";

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

  // Même logique UX que le bouton "Voir sur carte": focus auto sur le premier résultat.
  if (currentFilter) {
    focusFirstFilteredSignalement();
  }
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

    if (sig.user_nom) {
      const author = document.createElement("p");
      author.className = "carte-signalement-author";
      author.textContent = "Par : " + sig.user_nom;
      card.appendChild(author);
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
    btnVoirCarte.addEventListener("click", (e) => {
      e.preventDefault();
      console.log("Voir sur carte cliqué pour:", sig.titre, {
        lat: sig.lat,
        lng: sig.lng,
      });
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

function focusSignalementOnMap(sig) {
  console.log("focusSignalementOnMap appelée pour:", sig.titre);

  if (!map) {
    console.error("❌ Carte non initialisée");
    alert("La carte n'est pas encore initialisée. Rafraîchissez la page.");
    return;
  }

  if (!sig) {
    console.error("❌ Signalement vide");
    alert("Signalement invalide.");
    return;
  }

  // Convertir les coordonnées au cas où elles viendraient en string
  const lat = Number(sig.lat);
  const lng = Number(sig.lng);

  if (isNaN(lat) || isNaN(lng) || sig.lat == null || sig.lng == null) {
    console.error(
      `❌ Coordonnées invalides ou manquantes pour "${sig.titre}":`,
      { lat: sig.lat, lng: sig.lng, parsedLat: lat, parsedLng: lng },
    );
    alert(
      `Ce signalement n'a pas de coordonnées GPS valides.\nAdresse: ${sig.lieu || "inconnue"}`,
    );
    return;
  }

  console.log(`✓ Affichage sur carte pour "${sig.titre}" aux coords:`, [
    lat,
    lng,
  ]);

  // Scroller vers la carte (première)
  const mapContainer = document.getElementById("map-container");
  if (mapContainer) {
    mapContainer.scrollIntoView({ behavior: "smooth", block: "start" });
    console.log("✓ Scroll vers la carte...");
  }

  // Recentrer + zoom similaire au bouton "Voir sur carte".
  map.flyTo([lat, lng], 16, { duration: 1.2 });

  // Ouvrir le popup du marqueur correspondant.
  const marker = markers.find((m) => m._sigTimestamp === sig.timestamp);
  if (marker) {
    console.log("✓ Marqueur trouvé, ouverture du popup...");
    window.setTimeout(() => {
      try {
        marker.openPopup();
      } catch (e) {
        console.error("Erreur ouverture popup:", e);
      }
    }, 350);
  } else {
    console.warn(
      "⚠ Aucun marqueur trouvé pour ce signalement (coords peut-être absentes lors du chargement initial)",
    );
  }
}

function focusFirstFilteredSignalement() {
  const filtered = signalements.filter(
    (s) => !currentFilter || (s.type && s.type.toLowerCase() === currentFilter),
  );

  if (!filtered.length) return;
  focusSignalementOnMap(filtered[0]);
}
