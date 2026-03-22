/* SIGNALEMENT.JS - VERSION INITIALE BASIQUE (localStorage, sans backend/géocodage) */

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");

  if (menuBurger && navigationMenu) {
    const burgerIcon = menuBurger.querySelector("i");
    const updateBurgerIcon = () => {
      if (!burgerIcon) return;
      const isOpen = navigationMenu.classList.contains("mobile-active");
      burgerIcon.classList.toggle("bx-menu", !isOpen);
      burgerIcon.classList.toggle("bx-x", isOpen);
    };

    menuBurger.addEventListener("click", (e) => {
      e.stopPropagation();
      navigationMenu.classList.toggle("mobile-active");
      updateBurgerIcon();
    });

    // Fermer le menu quand un lien est cliqué
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigationMenu.classList.remove("mobile-active");
        updateBurgerIcon();
      });
    });

    document.addEventListener("click", (e) => {
      if (!navigationMenu.classList.contains("mobile-active")) return;

      const menuRect = navigationMenu.getBoundingClientRect();
      const clickedOverlayZone = e.clientX < menuRect.left;
      const clickedInsideMenu = navigationMenu.contains(e.target);
      const clickedBurger = menuBurger.contains(e.target);

      if (clickedOverlayZone || (!clickedInsideMenu && !clickedBurger)) {
        navigationMenu.classList.remove("mobile-active");
        updateBurgerIcon();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        navigationMenu.classList.remove("mobile-active");
        updateBurgerIcon();
      }
    });

    updateBurgerIcon();
  }
}

let map;
let markers = [];
let signalements = [];
const DRC_CENTER = [-2.8797, 23.656];
const DRC_DEFAULT_ZOOM = 6;
const ADDRESS_PREVIEW_ZOOM = 16;
const SIGNAL_VIEW_ZOOM = 18;
const markerByTimestamp = new Map();
const DRC_BOUNDS = {
  south: -13.5,
  west: 12,
  north: 5.5,
  east: 31.5,
};

const FORBIDDEN_COUNTRIES = [
  "france",
  "belgique",
  "belgium",
  "allemagne",
  "germany",
  "espagne",
  "spain",
  "italie",
  "italy",
  "portugal",
  "royaume uni",
  "united kingdom",
  "uk",
  "angleterre",
  "suisse",
  "switzerland",
  "norvege",
  "norway",
  "suede",
  "sweden",
  "danemark",
  "denmark",
  "pays bas",
  "netherlands",
  "maroc",
  "morocco",
  "algerie",
  "algeria",
  "tunisie",
  "tunisia",
  "senegal",
  "cote d ivoire",
  "ivory coast",
  "cameroun",
  "cameroon",
  "nigeria",
  "ghana",
  "kenya",
  "uganda",
  "rwanda",
  "burundi",
  "zambie",
  "zambia",
  "angola",
  "gabon",
  "tchad",
  "chad",
  "afrique du sud",
  "south africa",
  "etats unis",
  "united states",
  "usa",
  "canada",
];

let addressPreviewTimer = null;
let previewRequestId = 0;
let addressStatusEl = null;
let addressChosenFromMap = false;
let currentFilter = null;

async function readPhotoAsDataURL(file) {
  if (!file) return "";

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("La photo dépasse 5MB.");
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire la photo."));
    reader.readAsDataURL(file);
  });
}

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

  const btnShowAll = document.getElementById("btn-show-all");
  if (btnShowAll) {
    btnShowAll.addEventListener("click", showAllSignalements);
  }

  installAddressLivePreview();
  addFilterListeners();
  setAddressStatus("info", "Saisissez une adresse en RDC pour vérification.");

  updateTotalSignalements();
});

function ensureAddressStatusElement() {
  if (addressStatusEl && document.body.contains(addressStatusEl)) {
    return addressStatusEl;
  }
  addressStatusEl = document.getElementById("lieu-status");
  return addressStatusEl;
}

function resolveCurrentUserName() {
  const candidates = [
    localStorage.getItem("user_nom"),
    localStorage.getItem("username"),
    localStorage.getItem("nom"),
    localStorage.getItem("display_name"),
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  return candidates[0] || "Utilisateur local";
}

function addFilterListeners() {
  document.querySelectorAll(".filter-icon").forEach((img) => {
    img.addEventListener("click", () => {
      const type = String(img.dataset.type || "").toLowerCase();
      if (!type) return;
      if (currentFilter === type) {
        setFilter(null);
      } else {
        setFilter(type);
      }
    });
  });
}

function showAllSignalements() {
  currentFilter = null;

  const activeFilter = document.getElementById("activeFilter");
  if (activeFilter) {
    activeFilter.textContent = "Tous";
  }

  document.querySelectorAll(".filter-icon").forEach((img) => {
    img.classList.remove("active-filter");
  });

  // Rebuild map/list to ensure every marker and card is visible.
  renderMap();
  renderList();
  updateTotalSignalements();

  // After "Voir sur carte", map can stay highly zoomed on one point.
  // Reframe the view so all signalements become visible on the map.
  const visibleMarkers = markers.filter((m) => {
    try {
      return map.hasLayer(m);
    } catch (e) {
      return false;
    }
  });

  if (!map || visibleMarkers.length === 0) {
    if (map) map.setView(DRC_CENTER, DRC_DEFAULT_ZOOM);
    return;
  }

  if (visibleMarkers.length === 1) {
    map.setView(visibleMarkers[0].getLatLng(), 14);
    return;
  }

  const group = L.featureGroup(visibleMarkers);
  const bounds = group.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  } else {
    map.setView(DRC_CENTER, DRC_DEFAULT_ZOOM);
  }
}

function setFilter(type) {
  currentFilter = type ? String(type).toLowerCase() : null;

  const activeFilter = document.getElementById("activeFilter");
  if (activeFilter) {
    activeFilter.textContent = currentFilter || "Tous";
  }

  document.querySelectorAll(".filter-icon").forEach((img) => {
    const imgType = String(img.dataset.type || "").toLowerCase();
    img.classList.toggle(
      "active-filter",
      Boolean(currentFilter && imgType === currentFilter),
    );
  });

  updateMarkersVisibility();
  renderList();
  updateTotalSignalements();
}

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

function clearResolvedAddressCache(lieuInput) {
  if (!lieuInput) return;
  delete lieuInput.dataset.geocodeQuery;
  delete lieuInput.dataset.formattedAddress;
  delete lieuInput.dataset.geocodeLat;
  delete lieuInput.dataset.geocodeLng;
}

function setResolvedAddressCache(
  lieuInput,
  geocodeQuery,
  formattedAddress,
  lat,
  lng,
) {
  if (!lieuInput) return;
  lieuInput.dataset.geocodeQuery = String(geocodeQuery || "").trim();
  lieuInput.dataset.formattedAddress = String(formattedAddress || "").trim();
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    lieuInput.dataset.geocodeLat = String(lat);
    lieuInput.dataset.geocodeLng = String(lng);
  }
}

function setAddressStatus(state, text) {
  const el = ensureAddressStatusElement();
  if (!el) return;

  el.classList.remove("is-info", "is-success", "is-error");
  if (state === "success") {
    el.classList.add("is-success");
  } else if (state === "error") {
    el.classList.add("is-error");
  } else {
    el.classList.add("is-info");
  }
  el.textContent = text || "";
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9,\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validateAddressInput(rawAddress) {
  const normalized = normalizeText(rawAddress);
  if (!normalized || normalized.length < 3) {
    return {
      valid: false,
      message: "Veuillez saisir une adresse (au moins 3 caractères).",
    };
  }

  if (FORBIDDEN_COUNTRIES.some((c) => normalized.includes(c))) {
    return {
      valid: false,
      message:
        "Adresse refusée : veuillez saisir une adresse située uniquement en RDC.",
    };
  }

  return { valid: true, normalized: normalized };
}

function installAddressLivePreview() {
  const lieuInput = document.getElementById("lieu");
  if (!lieuInput || lieuInput._mapPreviewInstalled) return;

  const runPreview = async () => {
    const value = lieuInput.value.trim();
    if (!value) {
      setAddressStatus(
        "info",
        "Saisissez une adresse en RDC pour vérification.",
      );
      return;
    }

    const hasCachedResolvedAddress =
      lieuInput.dataset &&
      lieuInput.dataset.formattedAddress === value &&
      Boolean(lieuInput.dataset.geocodeQuery);
    if (hasCachedResolvedAddress) {
      const cachedLat = Number.parseFloat(lieuInput.dataset.geocodeLat || "");
      const cachedLng = Number.parseFloat(lieuInput.dataset.geocodeLng || "");
      if (map && Number.isFinite(cachedLat) && Number.isFinite(cachedLng)) {
        map.flyTo([cachedLat, cachedLng], ADDRESS_PREVIEW_ZOOM, {
          duration: 0.7,
        });
      }
      setAddressStatus("success", "Adresse déjà reconnue et validée.");
      return;
    }

    const validation = validateAddressInput(value);
    if (!validation.valid) {
      setAddressStatus("error", validation.message);
      return;
    }

    const requestId = ++previewRequestId;
    setAddressStatus("info", "Vérification de l'adresse en cours...");
    try {
      const geo = await geocodeAddressInDRC(value);
      if (requestId !== previewRequestId) return;

      if (!geo) {
        setAddressStatus(
          "error",
          "Adresse inexistante sur la carte en RDC. Vérifiez l'orthographe.",
        );
        return;
      }

      if (!map) return;
      map.flyTo([geo.lat, geo.lng], ADDRESS_PREVIEW_ZOOM, { duration: 0.9 });
      const formatted = geo.formattedAddress || geo.displayName;
      lieuInput.value = formatted;
      setResolvedAddressCache(
        lieuInput,
        geo.displayName || value,
        formatted,
        geo.lat,
        geo.lng,
      );
      setAddressStatus(
        "success",
        "Adresse reconnue et complétée automatiquement.",
      );
    } catch (e) {
      setAddressStatus("error", "Service de géolocalisation indisponible.");
    }
  };

  const schedulePreview = () => {
    if (addressPreviewTimer) {
      window.clearTimeout(addressPreviewTimer);
    }
    addressPreviewTimer = window.setTimeout(runPreview, 1000);
  };

  const schedulePreviewAfterManualEdit = () => {
    addressChosenFromMap = false;
    clearResolvedAddressCache(lieuInput);
    schedulePreview();
  };

  lieuInput.addEventListener("input", schedulePreviewAfterManualEdit);
  lieuInput.addEventListener("change", schedulePreview);
  lieuInput._mapPreviewInstalled = true;
}

function isInDRCBounds(lat, lng) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= DRC_BOUNDS.south &&
    lat <= DRC_BOUNDS.north &&
    lng >= DRC_BOUNDS.west &&
    lng <= DRC_BOUNDS.east
  );
}

function firstNonEmpty(values) {
  for (const v of values) {
    if (v != null) {
      const s = String(v).trim();
      if (s) return s;
    }
  }
  return "";
}

function formatCompleteDRCAddress(addressObj, fallbackDisplayName) {
  const address = addressObj || {};
  const fallbackTokens = String(fallbackDisplayName || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/congo|rdc|democratic republic/i.test(s));

  const fallbackRoad = fallbackTokens[0] || "Avenue principale";
  const fallbackQuarter =
    fallbackTokens[1] || fallbackTokens[0] || "Quartier central";
  const fallbackCommune =
    fallbackTokens[2] ||
    fallbackTokens[1] ||
    fallbackTokens[0] ||
    "Commune centrale";
  const fallbackCity =
    fallbackTokens[3] || fallbackTokens[2] || fallbackTokens[1] || "Kinshasa";

  const avenue = firstNonEmpty([
    address.road,
    address.pedestrian,
    address.footway,
    address.path,
    address.residential,
    address.cycleway,
    fallbackRoad,
  ]);
  const quarter = firstNonEmpty([
    address.quarter,
    address.neighbourhood,
    address.suburb,
    address.hamlet,
    address.city_district,
    fallbackQuarter,
  ]);
  const commune = firstNonEmpty([
    address.borough,
    address.municipality,
    address.county,
    address.township,
    fallbackCommune,
  ]);
  const city = firstNonEmpty([
    address.city,
    address.town,
    address.village,
    address.state_district,
    address.state,
    fallbackCity,
  ]);

  const parts = [
    `Avenue/Rue ${avenue}`,
    `Quartier ${quarter}`,
    `Commune ${commune}`,
    `Ville ${city}`,
    "RDC",
  ];
  return parts.join(", ");
}

async function geocodeAddressInDRC(rawAddress) {
  const normalized = normalizeText(rawAddress);
  const query = encodeURIComponent(normalized);
  const url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&addressdetails=1" +
    "&countrycodes=cd&bounded=1" +
    "&viewbox=" +
    `${DRC_BOUNDS.west},${DRC_BOUNDS.north},${DRC_BOUNDS.east},${DRC_BOUNDS.south}` +
    "&q=" +
    query;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Le service de géolocalisation est indisponible.");
  }

  const rows = await response.json();
  if (!Array.isArray(rows) || rows.length === 0) {
    return null;
  }

  const row = rows[0];
  const lat = parseFloat(row.lat);
  const lng = parseFloat(row.lon);
  const countryCode = String(row?.address?.country_code || "").toLowerCase();

  if (countryCode !== "cd" || !isInDRCBounds(lat, lng)) {
    return null;
  }

  return {
    lat: lat,
    lng: lng,
    displayName: row.display_name || rawAddress,
    formattedAddress: formatCompleteDRCAddress(
      row.address,
      row.display_name || rawAddress,
    ),
    addressDetails: row.address || {},
  };
}

async function reverseGeocodeInDRC(lat, lng) {
  if (!isInDRCBounds(lat, lng)) return null;

  const url =
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1" +
    `&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lng))}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error("Le service de géolocalisation est indisponible.");
  }

  const row = await response.json();
  const countryCode = String(row?.address?.country_code || "").toLowerCase();
  if (countryCode !== "cd") return null;

  return {
    displayName: row.display_name || null,
    formattedAddress: formatCompleteDRCAddress(row.address, row.display_name),
    addressDetails: row.address || {},
  };
}

function initMap() {
  map = L.map("map").setView(DRC_CENTER, DRC_DEFAULT_ZOOM);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // Click to set location
  map.on("click", async function (e) {
    const lieuInput = document.getElementById("lieu");
    if (!lieuInput) return;

    setAddressStatus("info", "Recherche de l'adresse depuis la carte...");
    try {
      const reverse = await reverseGeocodeInDRC(e.latlng.lat, e.latlng.lng);
      if (!reverse || !reverse.formattedAddress) {
        setAddressStatus(
          "error",
          "Adresse inexistante sur la carte pour ce point en RDC.",
        );
        return;
      }

      lieuInput.value = reverse.formattedAddress;
      setResolvedAddressCache(
        lieuInput,
        reverse.displayName || reverse.formattedAddress,
        reverse.formattedAddress,
        e.latlng.lat,
        e.latlng.lng,
      );
      addressChosenFromMap = true;
      setAddressStatus(
        "success",
        "Adresse OK: sélectionnée directement depuis la carte.",
      );
    } catch (err) {
      setAddressStatus(
        "error",
        "Impossible de récupérer l'adresse depuis la carte.",
      );
    }
  });

  renderMap();
}

async function addSignalement(e) {
  e.preventDefault();
  const titre = document.getElementById("titre-probleme").value.trim();
  const type = document.getElementById("type-probleme").value;
  const desc = document.getElementById("description").value.trim();
  const lieu = document.getElementById("lieu").value.trim();
  const lieuInput = document.getElementById("lieu");
  const photoInput = document.getElementById("photo");
  const photoFile =
    photoInput && photoInput.files && photoInput.files[0]
      ? photoInput.files[0]
      : null;

  if (!titre || !desc) {
    alert("Titre et description requis");
    return;
  }

  const validation = validateAddressInput(lieu);
  if (!validation.valid) {
    setAddressStatus("error", validation.message);
    alert(validation.message);
    return;
  }

  let geo = null;
  const queryForGeocode =
    lieuInput &&
    lieuInput.dataset &&
    lieuInput.dataset.formattedAddress === lieu &&
    lieuInput.dataset.geocodeQuery
      ? lieuInput.dataset.geocodeQuery
      : lieu;
  setAddressStatus("info", "Vérification finale de l'adresse...");
  try {
    geo = await geocodeAddressInDRC(queryForGeocode);
  } catch (error) {
    console.error(error);
    setAddressStatus("error", "Service de géolocalisation indisponible.");
    alert("Impossible de vérifier l'adresse pour le moment. Réessayez.");
    return;
  }

  if (!geo) {
    setAddressStatus(
      "error",
      "Adresse inexistante sur la carte ou hors RDC. Vérifiez l'adresse.",
    );
    alert(
      "Adresse inexistante sur la carte ou hors RDC. Vérifiez rue/avenue, quartier, commune et ville.",
    );
    return;
  }

  if (addressChosenFromMap) {
    setAddressStatus(
      "success",
      "Adresse OK: sélectionnée directement depuis la carte.",
    );
  } else {
    if (lieuInput) {
      const formatted = geo.formattedAddress || geo.displayName || lieu;
      lieuInput.value = formatted;
      setResolvedAddressCache(
        lieuInput,
        geo.displayName || queryForGeocode,
        formatted,
      );
    }
    setAddressStatus(
      "success",
      "Adresse reconnue et complétée automatiquement.",
    );
  }

  let photoDataUrl = "";
  try {
    photoDataUrl = await readPhotoAsDataURL(photoFile);
  } catch (error) {
    alert(error.message || "Photo invalide.");
    return;
  }

  const sig = {
    titre,
    type: String(type || "").toLowerCase(),
    description: desc,
    lieu: geo.formattedAddress || geo.displayName || lieu,
    lat: geo.lat,
    lng: geo.lng,
    adresseVerifiee: geo.displayName,
    user_nom: resolveCurrentUserName(),
    photo: photoDataUrl,
    timestamp: new Date().toISOString(),
  };

  signalements.unshift(sig); // Add to front
  localStorage.setItem("signalements", JSON.stringify(signalements));

  renderList();
  renderMap();
  updateTotalSignalements();

  // Centrer la carte sur le nouveau signalement
  if (map) {
    map.flyTo([sig.lat, sig.lng], 16, { duration: 1.2 });
  }
  setAddressStatus("success", `Signalement enregistré: ${geo.displayName}`);

  e.target.reset();
  addressChosenFromMap = false;
  document.getElementById("lieu").value = "";
  clearResolvedAddressCache(lieuInput);
  window.setTimeout(() => {
    setAddressStatus("info", "Saisissez une adresse en RDC pour vérification.");
  }, 900);
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
    if (
      currentFilter &&
      String(sig.type || "").toLowerCase() !== String(currentFilter)
    ) {
      return;
    }

    const card = document.createElement("div");
    card.className = "carte-signalement";
    card.dataset.ts = sig.timestamp;
    if (!sig.photo) {
      card.classList.add("no-photo");
    }

    if (sig.photo) {
      const img = document.createElement("img");
      img.src = sig.photo;
      img.alt = sig.titre || "Photo du signalement";
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
      focusSignalementOnMap(sig.timestamp);
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

function focusSignalementOnMap(timestamp) {
  const marker = markerByTimestamp.get(timestamp);
  if (!marker || !map) return;

  const mapEl = document.getElementById("map");
  if (mapEl) {
    mapEl.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const ll = marker.getLatLng();
  window.setTimeout(() => {
    try {
      map.invalidateSize();
      if (!map.hasLayer(marker)) {
        map.addLayer(marker);
      }
    } catch (e) {}
    map.flyTo([ll.lat, ll.lng], SIGNAL_VIEW_ZOOM, { duration: 1.1 });
  }, 250);

  window.setTimeout(() => {
    try {
      marker.openPopup();
    } catch (e) {}
  }, 700);
}

function renderMap() {
  // Clear existing markers
  markers.forEach((m) => map.removeLayer(m));
  markers = [];
  markerByTimestamp.clear();

  signalements.forEach((sig) => {
    const icon = getIconForType(sig.type);
    const markerOptions = icon ? { icon: icon } : {};
    const marker = L.marker([sig.lat, sig.lng], markerOptions).addTo(map)
      .bindPopup(`
        <b>${sig.titre}</b><br>
        <strong>${sig.type}</strong><br>
        ${sig.description}<br>
        📍 ${sig.lieu}<br>
        <small>Par : ${sig.user_nom || "Utilisateur local"}</small>
      `);
    marker._sigType = String(sig.type || "").toLowerCase();
    marker.on("click", () => {
      const ll = marker.getLatLng();
      map.flyTo([ll.lat, ll.lng], SIGNAL_VIEW_ZOOM, { duration: 0.9 });
      window.setTimeout(() => {
        try {
          marker.openPopup();
        } catch (e) {}
      }, 250);
    });
    markers.push(marker);
    markerByTimestamp.set(sig.timestamp, marker);
  });

  updateMarkersVisibility();
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
  if (elAll) {
    const filtered = signalements.filter(
      (s) =>
        !currentFilter || String(s.type || "").toLowerCase() === currentFilter,
    );
    elAll.textContent = filtered.length;
  }
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
      url: iconBasePath + "icons8-%C3%A9lectricit%C3%A9-32.png",
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
