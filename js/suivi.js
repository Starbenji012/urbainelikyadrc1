let map = null; // Variable globale pour la carte
let signalements = [];
let markers = [];

// Endpoints testés dans l'ordre. Si aucun backend ne répond, on bascule en local.
const SIGNALEMENTS_API_ENDPOINTS = buildApiEndpoints("signalements/index.php");
const SUIVI_TEXT = {
  mapNotReady: "La carte n'est pas encore initialisée. Rafraîchissez la page.",
  invalidSignalement: "Signalement invalide.",
  invalidGpsPrefix: "Ce signalement n'a pas de coordonnées GPS valides.",
  unknownAddress: "inconnue",
  unknownDate: "Date inconnue",
};

let currentFilter = null;

// Carrousel infini pour signalements
const MIN_CARDS_FOR_AUTO_SCROLL = 3;
const AUTO_SCROLL_STEP_PX = 1;
const AUTO_SCROLL_TICK_MS = 26;
const MANUAL_PAUSE_MS = 1400;

let carouselIntervalId = null;
let pauseUntil = 0;
let isHoverPaused = false;

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagée dans utils.js.
  initMenuBurger();

  // Initialiser la carte
  initMap();

  // Récupération des signalements depuis le backend.
  loadAndDisplaySignalements();

  // Ajout des écouteurs de filtrage.
  addFilterListeners();

  // Écouteur du bouton "Afficher tous".
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
    }
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
  signalements.forEach((sig) => {
    addMarkerToMap(sig);
  });

  // Afficher la liste des signalements
  renderSignalementsList();

  // Initialiser le carousel infini
  setupCarouselSignalements();

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
  const typeMeta = getSignalementTypeMeta(sig.type);
  const typeIconMarkup = typeMeta.iconUrl
    ? '<img src="' +
      typeMeta.iconUrl +
      '" alt="' +
      typeMeta.label +
      '" class="carte-signalement-type-icon">'
    : "";
  popupContent +=
    '<div class="popup-badges">' +
    '<span class="carte-signalement-type type-' +
    typeMeta.key +
    '">' +
    typeIconMarkup +
    typeMeta.label +
    "</span>" +
    '<span class="popup-signalement-status">En cours</span>' +
    "</div>";
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
  const config = getSignalementTypeMeta(typeValue);

  if (!config.iconUrl) return null;

  const size = Array.isArray(config.size) ? config.size : [32, 32];
  return L.icon({
    iconUrl: config.iconUrl,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]],
  });
}

function formatSignalementTypeLabel(typeValue) {
  const key = String(typeValue || "").toLowerCase();
  const labels = {
    voirie: "Route abimée",
    eau: "Eau",
    electricite: "Electricité",
    insecurite: "Insécurité",
    dechet: "Déchet",
  };

  return labels[key] || "Autre";
}

function getSignalementTypeMeta(typeValue) {
  const iconBasePath = "../icon-map/";
  const key = String(typeValue || "").toLowerCase();
  const map = {
    voirie: {
      key: "voirie",
      label: "Route abimée",
      iconUrl: iconBasePath + "icons8-route-48.png",
      size: [48, 48],
    },
    eau: {
      key: "eau",
      label: "Eau",
      iconUrl: iconBasePath + "icons8-eau-48.png",
      size: [48, 48],
    },
    electricite: {
      key: "electricite",
      label: "Electricité",
      iconUrl: iconBasePath + "icons8-électricité-32.png",
      size: [32, 32],
    },
    insecurite: {
      key: "insecurite",
      label: "Insécurité",
      iconUrl: iconBasePath + "icons8-protection-du-trou-de-serrure-48.png",
      size: [48, 48],
    },
    dechet: {
      key: "dechet",
      label: "Déchet",
      iconUrl: iconBasePath + "icons8-corbeille-48.png",
      size: [48, 48],
    },
  };

  return (
    map[key] || {
      key: "autre",
      label: formatSignalementTypeLabel(typeValue),
      iconUrl: "",
      size: [32, 32],
    }
  );
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
  if (af) {
    af.textContent = currentFilter
      ? formatSignalementTypeLabel(currentFilter)
      : "Tous";
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

  // Réinitialiser le carousel
  setupCarouselSignalements();

  // Mettre à jour les compteurs
  updateCounters();

  // Reporter l'animation de carte après les mises à jour DOM pour éviter les saccades.
  // Utiliser un double requestAnimationFrame pour laisser le navigateur terminer le repaint.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (currentFilter) {
        focusFilteredSignalementsOnMap();
      } else {
        focusAllSignalementsOnMap();
      }
    });
  });
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

    // Ajouter la classe no-photo si aucune photo pour compacter la carte.
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

    const typeMeta = getSignalementTypeMeta(sig.type);
    const type = document.createElement("span");
    type.className = `carte-signalement-type type-${typeMeta.key}`;

    if (typeMeta.iconUrl) {
      const typeIcon = document.createElement("img");
      typeIcon.src = typeMeta.iconUrl;
      typeIcon.alt = typeMeta.label;
      typeIcon.className = "carte-signalement-type-icon";
      type.appendChild(typeIcon);
    }

    type.appendChild(document.createTextNode(typeMeta.label));
    card.appendChild(type);

    const status = document.createElement("span");
    status.className = "carte-signalement-status";
    status.textContent = "En cours";
    card.appendChild(status);

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
        meta.textContent = SUIVI_TEXT.unknownDate;
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
  if (!map) {
    console.error("❌ Carte non initialisée");
    alert(SUIVI_TEXT.mapNotReady);
    return;
  }

  if (!sig) {
    console.error("❌ Signalement vide");
    alert(SUIVI_TEXT.invalidSignalement);
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
      `${SUIVI_TEXT.invalidGpsPrefix}\nAdresse: ${sig.lieu || SUIVI_TEXT.unknownAddress}`,
    );
    return;
  }

  // Scroller vers la carte (première)
  const mapContainer = document.getElementById("map-container");
  if (mapContainer) {
    mapContainer.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Recentrer + zoom similaire au bouton "Voir sur carte".
  map.flyTo([lat, lng], 16, { duration: 1.2 });

  // Ouvrir le popup du marqueur correspondant.
  const marker = markers.find((m) => m._sigTimestamp === sig.timestamp);
  if (marker) {
    window.setTimeout(() => {
      try {
        marker.openPopup();
      } catch (e) {
        console.error("Erreur ouverture popup:", e);
      }
    }, 350);
  }
}

function focusFilteredSignalementsOnMap() {
  if (!map) return;

  const carousel = document.getElementById("listeSignalements");

  // Mettre en pause le carrousel pendant l'animation de carte pour éviter les saccades.
  const wasAutoScrolling = carouselIntervalId !== null;
  if (carouselIntervalId) {
    stopInfiniteScrollSignalements();
  }

  const visibleMarkers = markers.filter((m) => {
    const t = String(m._sigType || "").toLowerCase();
    return !currentFilter || t === currentFilter;
  });

  if (!visibleMarkers.length) {
    // Reprendre uniquement s'il était actif avant.
    if (wasAutoScrolling) {
      startInfiniteScrollSignalements(carousel);
    }
    return;
  }

  const bounds = L.latLngBounds(visibleMarkers.map((m) => m.getLatLng()));

  // Reprendre le carrousel après la fin de l'animation de carte.
  map.once("moveend", () => {
    if (wasAutoScrolling) {
      startInfiniteScrollSignalements(carousel);
    }
  });

  map.flyToBounds(bounds, {
    padding: [35, 35],
    maxZoom: 16,
    duration: 1.1,
  });
}

function focusAllSignalementsOnMap() {
  if (!map) return;

  const carousel = document.getElementById("listeSignalements");

  // Mettre en pause le carrousel pendant l'animation de carte pour éviter les saccades.
  const wasAutoScrolling = carouselIntervalId !== null;
  if (carouselIntervalId) {
    stopInfiniteScrollSignalements();
  }

  if (!markers.length) {
    // Reprendre uniquement s'il était actif avant.
    if (wasAutoScrolling) {
      startInfiniteScrollSignalements(carousel);
    }
    return;
  }

  const bounds = L.latLngBounds(markers.map((m) => m.getLatLng()));

  // Reprendre le carrousel après la fin de l'animation de carte.
  map.once("moveend", () => {
    if (wasAutoScrolling) {
      startInfiniteScrollSignalements(carousel);
    }
  });

  map.flyToBounds(bounds, {
    padding: [35, 35],
    maxZoom: 16,
    duration: 1.1,
  });
}

/* ========== CAROUSEL INFINI POUR SIGNALEMENTS ========== */

function setupCarouselSignalements() {
  const carousel = document.getElementById("listeSignalements");
  const btnPrev = document.getElementById("carouselPrevSignalements");
  const btnNext = document.getElementById("carouselNextSignalements");

  if (!carousel) return;

  stopInfiniteScrollSignalements();
  prepareInfiniteCarouselSignalements(carousel);

  const baseCount = Number(carousel.dataset.baseCount || 0);
  if (baseCount <= MIN_CARDS_FOR_AUTO_SCROLL) {
    carousel.scrollLeft = 0;
    return;
  }

  const step = getCardStepSignalements(carousel);

  if (btnPrev && btnPrev.dataset.bound !== "1") {
    btnPrev.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: -step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePositionSignalements(carousel), 380);
    });
    btnPrev.dataset.bound = "1";
  }

  if (btnNext && btnNext.dataset.bound !== "1") {
    btnNext.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePositionSignalements(carousel), 380);
    });
    btnNext.dataset.bound = "1";
  }

  if (carousel.dataset.hoverBound !== "1") {
    carousel.addEventListener("mouseover", (event) => {
      if (event.target.closest(".carte-signalement")) {
        isHoverPaused = true;
      }
    });

    carousel.addEventListener("mouseout", (event) => {
      const leavingCard = event.target.closest(".carte-signalement");
      const stillInsideCard =
        event.relatedTarget?.closest?.(".carte-signalement");
      if (leavingCard && !stillInsideCard) {
        isHoverPaused = false;
      }
    });

    carousel.dataset.hoverBound = "1";
  }

  startInfiniteScrollSignalements(carousel);
}

function prepareInfiniteCarouselSignalements(carousel) {
  const originals = Array.from(carousel.querySelectorAll(".carte-signalement"));
  const originalCount = originals.length;
  carousel.dataset.baseCount = String(originalCount);

  if (originalCount <= MIN_CARDS_FOR_AUTO_SCROLL) {
    carousel.dataset.loopSpan = "0";
    carousel.scrollLeft = 0;
    return;
  }

  if (originals.length === 0) return;

  const prependFrag = document.createDocumentFragment();
  const appendFrag = document.createDocumentFragment();

  originals.forEach((card) => {
    prependFrag.appendChild(card.cloneNode(true));
    appendFrag.appendChild(card.cloneNode(true));
  });

  carousel.prepend(prependFrag);
  carousel.append(appendFrag);

  const step = getCardStepSignalements(carousel);
  const span = step * originalCount;
  carousel.dataset.loopSpan = String(span);
  carousel.scrollLeft = span;
}

function getCardStepSignalements(carousel) {
  const cards = carousel.querySelectorAll(".carte-signalement");
  if (cards.length >= 2) {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    if (step > 0) return step;
  }
  return 320;
}

function normalizeInfinitePositionSignalements(carousel) {
  const span = Number(carousel.dataset.loopSpan || 0);
  if (!span) return;

  if (carousel.scrollLeft >= span * 2) {
    carousel.scrollLeft -= span;
  } else if (carousel.scrollLeft < span * 0.5) {
    carousel.scrollLeft += span;
  }
}

function startInfiniteScrollSignalements(carousel) {
  if (!carousel) {
    carousel = document.getElementById("listeSignalements");
  }
  if (!carousel) return;

  stopInfiniteScrollSignalements();

  carouselIntervalId = setInterval(() => {
    if (!carousel.isConnected) return;

    if (!isHoverPaused && Date.now() >= pauseUntil) {
      carousel.scrollLeft += AUTO_SCROLL_STEP_PX;
      normalizeInfinitePositionSignalements(carousel);
    }
  }, AUTO_SCROLL_TICK_MS);
}

function stopInfiniteScrollSignalements() {
  if (carouselIntervalId) {
    clearInterval(carouselIntervalId);
    carouselIntervalId = null;
  }
}
