/* SIGNALEMENT.JS - Backend PHP avec fallback localStorage */

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
let selectedMapCoords = null;
let currentFilter = null;

const MIN_CARDS_FOR_AUTO_SCROLL = 3;
const AUTO_SCROLL_STEP_PX = 1;
const AUTO_SCROLL_TICK_MS = 26;
const MANUAL_PAUSE_MS = 1400;

let carouselIntervalId = null;
let pauseUntil = 0;
let isHoverPaused = false;

// Endpoints backend PHP testés dans l'ordre.
const SIGNALEMENTS_ENDPOINTS = [
  "/backend/api/signalements/index.php",
  "../backend/api/signalements/index.php",
  "backend/api/signalements/index.php",
];

const SIGNALEMENTS_DELETE_ENDPOINTS = [
  "/backend/api/signalements/delete.php",
  "../backend/api/signalements/delete.php",
  "backend/api/signalements/delete.php",
];

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

  // Chargement initial: récupération des signalements déjà enregistrés.
  const saved = localStorage.getItem("signalements");
  if (saved) {
    signalements = JSON.parse(saved);
  }

  // Initialisation de la carte et de l'affichage liste/carte.
  initMap();
  renderList();
  renderMap();
  loadSignalementsFromBackend();

  // Soumission du formulaire
  const form = document.getElementById("form-signalement");
  if (form) {
    form.addEventListener("submit", addSignalement);
  }

  // Vider tous les signalements
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

async function loadSignalementsFromBackend() {
  for (const endpoint of SIGNALEMENTS_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!resp.ok) continue;

      const data = await resp.json();
      if (!Array.isArray(data)) continue;

      // Fusion backend + local pour éviter de perdre des brouillons locaux.
      const mapByKey = new Map();
      [...data, ...signalements].forEach((sig) => {
        const k = String(
          sig?.id ||
            sig?.timestamp ||
            `${sig?.titre || ""}-${sig?.lat || ""}-${sig?.lng || ""}`,
        );
        if (!mapByKey.has(k)) {
          mapByKey.set(k, sig);
        }
      });

      signalements = Array.from(mapByKey.values());
      localStorage.setItem("signalements", JSON.stringify(signalements));
      renderList();
      renderMap();
      updateTotalSignalements();
      return;
    } catch (e) {
      // On essaie le prochain endpoint.
    }
  }
}

async function createSignalementToBackend(sig) {
  const payload = {
    titre: sig.titre,
    type: sig.type,
    description: sig.description,
    lieu: sig.lieu,
    lat: sig.lat,
    lng: sig.lng,
    user_nom: sig.user_nom,
    user_email: sig.user_email || "",
    photo: sig.photo || "",
  };

  for (const endpoint of SIGNALEMENTS_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json().catch(() => ({}));

      if (resp.ok) {
        return {
          ok: true,
          reachable: true,
          data: json?.data || sig,
          message: "",
        };
      }

      return {
        ok: false,
        reachable: true,
        data: null,
        message: json?.message || "Erreur de validation côté backend.",
      };
    } catch (e) {
      // On essaie le prochain endpoint.
    }
  }

  return {
    ok: false,
    reachable: false,
    data: null,
    message: "Backend indisponible.",
  };
}

async function deleteSignalementFromBackend(id) {
  for (const endpoint of SIGNALEMENTS_DELETE_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id }),
      });
      if (resp.ok) return true;
    } catch (e) {
      // On essaie le prochain endpoint.
    }
  }

  return false;
}

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

function resolveCurrentUserEmail() {
  return String(localStorage.getItem("user_email") || "")
    .trim()
    .toLowerCase();
}

function readCurrentProfile() {
  const nom = resolveCurrentUserName();
  const email = resolveCurrentUserEmail();
  const connected =
    String(localStorage.getItem("auth_connected") || "") === "1";
  return { connected, nom, email };
}

function isOwnedByCurrentUser(item) {
  const profile = readCurrentProfile();
  if (!profile.connected) return false;

  const itemEmail = String(item?.user_email || "")
    .trim()
    .toLowerCase();
  const itemNom = String(item?.user_nom || "")
    .trim()
    .toLowerCase();
  const profileNom = String(profile.nom || "")
    .trim()
    .toLowerCase();

  if (profile.email && itemEmail) return itemEmail === profile.email;
  return Boolean(profileNom && itemNom && itemNom === profileNom);
}

function getVisibleSignalements() {
  return signalements.filter((sig) => isOwnedByCurrentUser(sig));
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

  // Recalculer l'affichage pour remettre tous les éléments visibles.
  renderMap();
  renderList();
  updateTotalSignalements();

  // Recentrer de facon explicite sur tous les signalements visibles.
  focusAllSignalementsOnMap();
}

function setFilter(type) {
  // Le filtre ne garde qu'un type; null = tous.
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

  if (currentFilter) {
    focusFilteredSignalementsOnMap();
  } else {
    focusAllSignalementsOnMap();
  }
}

function updateMarkersVisibility() {
  // Afficher/masquer les marqueurs selon le filtre actif.
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
    selectedMapCoords = null;
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

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchNominatimJson(url, maxAttempts = 3) {
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
    });

    if (response.ok) {
      return response.json();
    }

    lastStatus = response.status;
    const canRetry = response.status === 429 || response.status >= 500;
    if (!canRetry || attempt === maxAttempts) {
      break;
    }

    // Backoff progressif simple pour eviter le rate-limit.
    await wait(500 * attempt);
  }

  throw new Error(
    `Le service de géolocalisation est indisponible (${lastStatus}).`,
  );
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

  const rows = await fetchNominatimJson(url, 3);
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
    "https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18" +
    `&lat=${encodeURIComponent(String(lat))}` +
    `&lon=${encodeURIComponent(String(lng))}`;

  const row = await fetchNominatimJson(url, 3);
  if (!row || typeof row !== "object") return null;

  // On accepte la reponse si le point clique est deja valide en RDC (controle fait avant l'appel).
  const hasAddressData = row.address || row.display_name;
  if (!hasAddressData) return null;

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

    selectedMapCoords = { lat: e.latlng.lat, lng: e.latlng.lng };

    if (!isInDRCBounds(e.latlng.lat, e.latlng.lng)) {
      setAddressStatus(
        "error",
        "Point hors RDC. Cliquez dans les limites de la RDC.",
      );
      addressChosenFromMap = false;
      return;
    }

    setAddressStatus("info", "Recherche de l'adresse depuis la carte...");
    try {
      const reverse = await reverseGeocodeInDRC(e.latlng.lat, e.latlng.lng);
      if (!reverse || !reverse.formattedAddress) {
        const fallbackAddress =
          "Adresse approximative: point sélectionné en RDC";
        lieuInput.value = fallbackAddress;
        setResolvedAddressCache(
          lieuInput,
          fallbackAddress,
          fallbackAddress,
          e.latlng.lat,
          e.latlng.lng,
        );
        addressChosenFromMap = true;
        setAddressStatus(
          "info",
          "Adresse approximative enregistrée (adresse détaillée indisponible).",
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
      const fallbackAddress = "Adresse approximative: point sélectionné en RDC";
      lieuInput.value = fallbackAddress;
      setResolvedAddressCache(
        lieuInput,
        fallbackAddress,
        fallbackAddress,
        e.latlng.lat,
        e.latlng.lng,
      );
      addressChosenFromMap = true;
      setAddressStatus(
        "info",
        "Adresse approximative enregistrée (service d'adresse temporairement indisponible).",
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

  const hasValidMapSelection =
    selectedMapCoords &&
    isInDRCBounds(Number(selectedMapCoords.lat), Number(selectedMapCoords.lng));

  // Si un point carte valide est déjà choisi, on ne bloque pas sur le texte d'adresse.
  if (!hasValidMapSelection) {
    const validation = validateAddressInput(lieu);
    if (!validation.valid) {
      setAddressStatus("error", validation.message);
      alert(validation.message);
      return;
    }
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
    if (hasValidMapSelection) {
      geo = {
        lat: selectedMapCoords.lat,
        lng: selectedMapCoords.lng,
        displayName: lieu || "Point sélectionné sur la carte (RDC)",
        formattedAddress: lieu || "Point sélectionné sur la carte (RDC)",
      };
      setAddressStatus(
        "info",
        "Adresse détaillée indisponible, adresse approximative utilisée.",
      );
    } else {
      setAddressStatus("error", "Service de géolocalisation indisponible.");
      alert("Impossible de vérifier l'adresse pour le moment. Réessayez.");
      return;
    }
  }

  if (!geo) {
    if (hasValidMapSelection) {
      geo = {
        lat: selectedMapCoords.lat,
        lng: selectedMapCoords.lng,
        displayName: lieu || "Point sélectionné sur la carte (RDC)",
        formattedAddress: lieu || "Point sélectionné sur la carte (RDC)",
      };
      setAddressStatus(
        "info",
        "Adresse approximative utilisée (adresse introuvable automatiquement).",
      );
    } else {
      setAddressStatus(
        "error",
        "Adresse inexistante sur la carte ou hors RDC. Vérifiez l'adresse.",
      );
      alert(
        "Adresse inexistante sur la carte ou hors RDC. Vérifiez rue/avenue, quartier, commune et ville.",
      );
      return;
    }
  }

  if (hasValidMapSelection) {
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
    id: `sig_local_${Date.now()}`,
    titre,
    type: String(type || "").toLowerCase(),
    description: desc,
    lieu: geo.formattedAddress || geo.displayName || lieu,
    lat: geo.lat,
    lng: geo.lng,
    adresseVerifiee: geo.displayName,
    user_nom: resolveCurrentUserName(),
    user_email: resolveCurrentUserEmail(),
    photo: photoDataUrl,
    timestamp: new Date().toISOString(),
  };

  // On essaye d'abord de persister sur le backend PHP.
  const backendSig = await createSignalementToBackend(sig);
  if (!backendSig.ok && backendSig.reachable) {
    alert(backendSig.message || "Le backend a refusé le signalement.");
    return;
  }

  const finalSig = backendSig.ok ? backendSig.data : sig;

  signalements.unshift(finalSig); // Add to front
  localStorage.setItem("signalements", JSON.stringify(signalements));

  renderList();
  renderMap();
  updateTotalSignalements();

  // Centrer la carte sur le nouveau signalement
  if (map) {
    map.flyTo([finalSig.lat, finalSig.lng], 16, { duration: 1.2 });
  }
  setAddressStatus("success", `Signalement enregistré: ${geo.displayName}`);

  e.target.reset();
  addressChosenFromMap = false;
  document.getElementById("lieu").value = "";
  clearResolvedAddressCache(lieuInput);
  window.setTimeout(() => {
    setAddressStatus("info", "Saisissez une adresse en RDC pour vérification.");
  }, 900);
  alert(
    backendSig.ok
      ? "Signalement ajouté (backend) !"
      : "Signalement ajouté en local (backend indisponible) !",
  );
}

function renderList() {
  const container = document.getElementById("listeSignalements");
  if (!container) return;

  container.innerHTML = "";

  const profile = readCurrentProfile();
  if (!profile.connected) {
    stopInfiniteScrollSignalementsPage();
    container.innerHTML =
      '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Connectez-vous pour voir vos signalements personnels.</p>';
    return;
  }

  const visibleSignalements = getVisibleSignalements();

  if (visibleSignalements.length === 0) {
    stopInfiniteScrollSignalementsPage();
    container.innerHTML =
      '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Aucun signalement pour votre compte.</p>';
    return;
  }

  const frag = document.createDocumentFragment();

  visibleSignalements.forEach((sig) => {
    if (
      currentFilter &&
      String(sig.type || "").toLowerCase() !== String(currentFilter)
    ) {
      return;
    }

    const card = document.createElement("div");
    card.className = "carte-signalement";
    card.dataset.ts = sig.id || sig.timestamp;
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
      focusSignalementOnMap(sig.id || sig.timestamp);
    });

    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn-delete-signalement";
    btnDelete.textContent = "Supprimer";
    btnDelete.addEventListener("click", () => {
      deleteSignalement(sig.id || sig.timestamp);
    });

    btnContainer.appendChild(btnVoirCarte);
    btnContainer.appendChild(btnDelete);
    card.appendChild(btnContainer);

    frag.appendChild(card);
  });

  container.appendChild(frag);
  setupCarouselSignalementsPage();
}

function setupCarouselSignalementsPage() {
  const carousel = document.getElementById("listeSignalements");
  const btnPrev = document.getElementById("carouselPrevSignalementsPage");
  const btnNext = document.getElementById("carouselNextSignalementsPage");

  if (!carousel) return;

  stopInfiniteScrollSignalementsPage();
  prepareInfiniteCarouselSignalementsPage(carousel);

  const baseCount = Number(carousel.dataset.baseCount || 0);
  const canScroll = baseCount > MIN_CARDS_FOR_AUTO_SCROLL;

  if (btnPrev) btnPrev.disabled = !canScroll;
  if (btnNext) btnNext.disabled = !canScroll;

  if (!canScroll) {
    carousel.scrollLeft = 0;
    return;
  }

  const step = getCardStepSignalementsPage(carousel);

  if (btnPrev && btnPrev.dataset.bound !== "1") {
    btnPrev.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: -step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePositionSignalementsPage(carousel), 380);
    });
    btnPrev.dataset.bound = "1";
  }

  if (btnNext && btnNext.dataset.bound !== "1") {
    btnNext.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePositionSignalementsPage(carousel), 380);
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

  startInfiniteScrollSignalementsPage(carousel);
}

function prepareInfiniteCarouselSignalementsPage(carousel) {
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

  const step = getCardStepSignalementsPage(carousel);
  const span = step * originalCount;
  carousel.dataset.loopSpan = String(span);
  carousel.scrollLeft = span;
}

function getCardStepSignalementsPage(carousel) {
  const cards = carousel.querySelectorAll(".carte-signalement");
  if (cards.length >= 2) {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    if (step > 0) return step;
  }
  return 320;
}

function normalizeInfinitePositionSignalementsPage(carousel) {
  const span = Number(carousel.dataset.loopSpan || 0);
  if (!span) return;

  if (carousel.scrollLeft >= span * 2) {
    carousel.scrollLeft -= span;
  } else if (carousel.scrollLeft < span * 0.5) {
    carousel.scrollLeft += span;
  }
}

function startInfiniteScrollSignalementsPage(carousel) {
  stopInfiniteScrollSignalementsPage();

  carouselIntervalId = setInterval(() => {
    if (!carousel.isConnected) return;

    if (!isHoverPaused && Date.now() >= pauseUntil) {
      carousel.scrollLeft += AUTO_SCROLL_STEP_PX;
      normalizeInfinitePositionSignalementsPage(carousel);
    }
  }, AUTO_SCROLL_TICK_MS);
}

function stopInfiniteScrollSignalementsPage() {
  if (carouselIntervalId) {
    clearInterval(carouselIntervalId);
    carouselIntervalId = null;
  }
}

function focusSignalementOnMap(idOrTimestamp) {
  const marker = markerByTimestamp.get(idOrTimestamp);
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

function focusFilteredSignalementsOnMap() {
  if (!map) return;

  const visibleMarkers = markers.filter((m) => {
    const t = String(m._sigType || "").toLowerCase();
    return !currentFilter || t === currentFilter;
  });

  if (!visibleMarkers.length) {
    map.flyTo(DRC_CENTER, DRC_DEFAULT_ZOOM, { duration: 0.9 });
    return;
  }

  const bounds = L.latLngBounds(visibleMarkers.map((m) => m.getLatLng()));
  map.flyToBounds(bounds, {
    padding: [30, 30],
    maxZoom: 16,
    duration: 1.1,
  });
}

function focusAllSignalementsOnMap() {
  if (!map) return;

  if (!markers.length) {
    map.flyTo(DRC_CENTER, DRC_DEFAULT_ZOOM, { duration: 0.9 });
    return;
  }

  const bounds = L.latLngBounds(markers.map((m) => m.getLatLng()));
  map.flyToBounds(bounds, {
    padding: [30, 30],
    maxZoom: 16,
    duration: 1.1,
  });
}

function renderMap() {
  // Clear existing markers
  markers.forEach((m) => map.removeLayer(m));
  markers = [];
  markerByTimestamp.clear();

  const visibleSignalements = getVisibleSignalements();

  visibleSignalements.forEach((sig) => {
    const icon = getIconForType(sig.type);
    const markerOptions = icon ? { icon: icon } : {};
    const photoMarkup = sig.photo
      ? `<img src="${sig.photo}" alt="${sig.titre || "Photo du signalement"}" class="popup-photo">`
      : "";

    const typeLabel = sig.type
      ? sig.type.charAt(0).toUpperCase() + sig.type.slice(1)
      : "Type non précisé";

    const marker = L.marker([sig.lat, sig.lng], markerOptions).addTo(map)
      .bindPopup(`
        <div class="popup-signalement">
          <b>${sig.titre || "Signalement"}</b>
          ${photoMarkup}
          <p><strong>${typeLabel}</strong></p>
          <p>${sig.description || "Aucune description"}</p>
          <p>📍 ${sig.lieu || "Adresse non spécifiée"}</p>
          <p><small>Par : ${sig.user_nom || "Utilisateur local"}</small></p>
        </div>
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
    markerByTimestamp.set(sig.id || sig.timestamp, marker);
  });

  updateMarkersVisibility();
}

async function deleteSignalement(idOrTimestamp) {
  if (confirm("Supprimer ce signalement ?")) {
    const target = signalements.find(
      (s) => String(s.id || s.timestamp) === String(idOrTimestamp),
    );
    if (target && target.id && !String(target.id).startsWith("sig_local_")) {
      await deleteSignalementFromBackend(target.id);
    }

    signalements = signalements.filter(
      (s) => String(s.id || s.timestamp) !== String(idOrTimestamp),
    );
    localStorage.setItem("signalements", JSON.stringify(signalements));
    renderList();
    renderMap();
    updateTotalSignalements();
  }
}

function clearSignalements() {
  if (confirm("Vider tous les signalements ?")) {
    // En page personnelle: on ne retire que les signalements du compte connecté.
    signalements = signalements.filter((sig) => !isOwnedByCurrentUser(sig));
    localStorage.setItem("signalements", JSON.stringify(signalements));
    renderList();
    renderMap();
    updateTotalSignalements();
  }
}

function updateTotalSignalements() {
  const profile = readCurrentProfile();
  if (!profile.connected) {
    const totalElDisconnected = document.getElementById("totalSignalements");
    if (totalElDisconnected) totalElDisconnected.textContent = "0";

    const filteredElDisconnected = document.getElementById(
      "totalSignalementsAfficheAll",
    );
    if (filteredElDisconnected) filteredElDisconnected.textContent = "0";
    return;
  }

  const allSignalements = getVisibleSignalements();
  const el = document.getElementById("totalSignalements");
  if (el) el.textContent = allSignalements.length;
  const elAll = document.getElementById("totalSignalementsAfficheAll");
  if (elAll) {
    const filtered = allSignalements.filter(
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
    // Type inconnu: Leaflet utilisera l'icone standard du marqueur.
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
