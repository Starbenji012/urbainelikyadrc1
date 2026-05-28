/* IDEES.JS - Backend PHP */

let idees = [];
let likesCommunaute = {};

const MIN_CARDS_FOR_AUTO_SCROLL = 3;
const AUTO_SCROLL_STEP_PX = 1;
const AUTO_SCROLL_TICK_MS = 26;
const MANUAL_PAUSE_MS = 1400;

let carouselIntervalId = null;
let pauseUntil = 0;
let isHoverPaused = false;
let currentFilter = null;

const IDEES_ENDPOINTS = buildApiEndpoints("idees/index.php");

const IDEES_DELETE_ENDPOINTS = buildApiEndpoints("idees/delete.php");

const IDEE_TEXT = {
  defaultUser: "Utilisateur local",
  photoTooLarge: "La photo dépasse 5MB.",
  photoReadError: "Impossible de lire la photo.",
  titleLength: "Le titre doit contenir entre 3 et 150 caractères.",
  descriptionLength: "La description doit contenir entre 5 et 2000 caractères.",
  invalidCategory: "Catégorie invalide.",
  backendRefused: "Le backend a refusé la requête.",
  mustBeConnected:
    "Vous devez être connecté pour proposer une idée. Veuillez vous connecter d'abord.",
  requiredFields: "Titre et description requis",
  invalidPhoto: "Photo invalide.",
  createdBackend: "Idée ajoutée (backend) !",
  backendUnavailable: "Backend indisponible.",
  mustLoginToView: "Connectez-vous pour voir vos idées personnelles.",
  noIdeasForAccount: "Aucune idée pour votre compte.",
  likeOnCommunity: "Le like se fait dans la page Communauté",
  confirmDelete: "Supprimer ?",
  deleteDenied: "Vous ne pouvez supprimer que vos propres idées.",
  confirmClear: "Vider toutes les idées ?",
};

function resolveCurrentUserName() {
  const candidates = [
    localStorage.getItem("user_nom"),
    localStorage.getItem("username"),
    localStorage.getItem("nom"),
    localStorage.getItem("display_name"),
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  return candidates[0] || IDEE_TEXT.defaultUser;
}

function resolveCurrentUserEmail() {
  return String(localStorage.getItem("user_email") || "")
    .trim()
    .toLowerCase();
}

function normalizeIdentityTokens(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function namesReferToSamePerson(profileName, itemName) {
  const profileTokens = normalizeIdentityTokens(profileName).filter(
    (token) => token.length > 2,
  );
  const itemTokens = normalizeIdentityTokens(itemName).filter(
    (token) => token.length > 2,
  );

  if (!profileTokens.length || !itemTokens.length) return false;
  if (profileTokens.join(" ") === itemTokens.join(" ")) return true;

  const profileInItem = profileTokens.every((token) =>
    itemTokens.includes(token),
  );
  const itemInProfile = itemTokens.every((token) =>
    profileTokens.includes(token),
  );
  return profileInItem || itemInProfile;
}

function readCurrentProfile() {
  const nom = resolveCurrentUserName();
  const email = resolveCurrentUserEmail();
  const userId = String(localStorage.getItem("user_id") || "").trim();
  const connected =
    String(localStorage.getItem("auth_connected") || "") === "1";
  return { connected, nom, email, userId };
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
  const itemUserId = String(item?.user_id || "").trim();

  if (profile.email && itemEmail) return itemEmail === profile.email;
  if (profile.userId && itemUserId) return itemUserId === profile.userId;
  return namesReferToSamePerson(profileNom, itemNom);
}

function getVisibleIdees() {
  return idees.filter((idee) => isOwnedByCurrentUser(idee));
}

function getIdeeLikeCount(idee) {
  // La page Idées affiche la valeur la plus récente entre backend et Communauté.
  const key = String(idee?.id || idee?.timestamp || "");
  const communityLikes = Number(likesCommunaute[key] || 0);
  const persistedLikes = Number(idee?.likes || 0);
  return Math.max(communityLikes, persistedLikes);
}

function getFilteredIdees() {
  // Retourne les idées de l'utilisateur filtré par catégorie (si filtre actif).
  let filtered = getVisibleIdees();
  if (currentFilter) {
    filtered = filtered.filter((idee) => {
      const ideeCat = String(idee?.categorie || "").toLowerCase();
      return ideeCat === currentFilter;
    });
  }
  return filtered;
}

function addFilterListenersIdees() {
  document.querySelectorAll(".filter-icon").forEach((img) => {
    img.addEventListener("click", () => {
      const type = String(img.dataset.type || "").toLowerCase();
      if (!type) return;
      if (currentFilter === type) {
        setFilterIdees(null);
      } else {
        setFilterIdees(type);
      }
    });
  });
}

function showAllIdees() {
  currentFilter = null;

  const activeFilter = document.getElementById("activeFilterIdees");
  if (activeFilter) {
    activeFilter.textContent = "Tous";
  }

  document.querySelectorAll(".filter-icon").forEach((img) => {
    img.classList.remove("active-filter");
  });

  renderIdees();
}

function formatIdeeFilterLabel(filterKey) {
  const key = String(filterKey || "").toLowerCase();
  const labels = {
    infrastructure: "Infrastructure",
    environnement: "Environnement",
    "services-publics": "Services Publics",
    transport: "Transport",
    autre: "Autre",
  };

  return labels[key] || "Tous";
}

function getIdeeCategoryMeta(category) {
  const key = String(category || "").toLowerCase();
  const map = {
    infrastructure: {
      key: "infrastructure",
      label: "Infrastructure",
      icon: "../icon-map/icons8-city-buildings-48.png",
    },
    environnement: {
      key: "environnement",
      label: "Environnement",
      icon: "../icon-map/icons8-soil-48.png",
    },
    "services-publics": {
      key: "services-publics",
      label: "Services Publics",
      icon: "../icon-map/icons8-service-48.png",
    },
    transport: {
      key: "transport",
      label: "Transport",
      icon: "../icon-map/icons8-taxi-48.png",
    },
    autre: {
      key: "autre",
      label: "Autre",
      icon: "../icon-map/icons8-view-more-48.png",
    },
  };

  return (
    map[key] || {
      key: "autre",
      label: formatIdeeFilterLabel(key),
      icon: "../icon-map/icons8-view-more-48.png",
    }
  );
}

function renderIdeeCategoryBadge(category) {
  const meta = getIdeeCategoryMeta(category);
  return `<span class="categorie-badge cat-${meta.key}"><img src="${meta.icon}" alt="${meta.label}" class="categorie-badge-icon">${meta.label}</span>`;
}

function renderIdeeStatusBadge() {
  return '<span class="idee-status-badge">En attente</span>';
}

function setFilterIdees(type) {
  // Le filtre ne garde qu'une catégorie; null = tous.
  currentFilter = type ? String(type).toLowerCase() : null;

  const activeFilter = document.getElementById("activeFilterIdees");
  if (activeFilter) {
    activeFilter.textContent = formatIdeeFilterLabel(currentFilter);
  }

  document.querySelectorAll(".filter-icon").forEach((img) => {
    const imgType = String(img.dataset.type || "").toLowerCase();
    img.classList.toggle(
      "active-filter",
      Boolean(currentFilter && imgType === currentFilter),
    );
  });

  renderIdees();
}

async function readPhotoAsDataURL(file) {
  if (!file) return "";

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error(IDEE_TEXT.photoTooLarge);
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(IDEE_TEXT.photoReadError));
    reader.readAsDataURL(file);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  (async () => {
    // Navigation mobile: logique partagée dans utils.js.
    initMenuBurger();
    await syncAuthStateFromBackend();
    renderIdees();
    loadIdeesFromBackend();

    const form = document.getElementById("formIdee");
    if (form) form.addEventListener("submit", addIdee);

    const btnVider = document.getElementById("btnViderIdees");
    if (btnVider) btnVider.addEventListener("click", clearIdees);

    const btnShowAll = document.getElementById("btn-show-all-idees");
    if (btnShowAll) btnShowAll.addEventListener("click", showAllIdees);

    addFilterListenersIdees();
  })();
});

function validateIdeePayload(idee) {
  if (!idee.titre || idee.titre.length < 3 || idee.titre.length > 150) {
    return IDEE_TEXT.titleLength;
  }

  if (
    !idee.description ||
    idee.description.length < 5 ||
    idee.description.length > 2000
  ) {
    return IDEE_TEXT.descriptionLength;
  }

  const allowedCategories = [
    "infrastructure",
    "environnement",
    "services-publics",
    "transport",
    "autre",
  ];

  if (!allowedCategories.includes(String(idee.categorie || "").toLowerCase())) {
    return IDEE_TEXT.invalidCategory;
  }

  return "";
}

function extractBackendErrorMessage(json) {
  if (json?.errors && typeof json.errors === "object") {
    const first = Object.values(json.errors).find(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
    if (first) return String(first);
  }

  if (typeof json?.message === "string" && json.message.trim()) {
    return json.message;
  }

  return IDEE_TEXT.backendRefused;
}

async function addIdee(e) {
  e.preventDefault();

  // Vérifier que l'utilisateur est connecté
  const profile = readCurrentProfile();
  if (!profile.connected) {
    alert(IDEE_TEXT.mustBeConnected);
    window.location.href = "connexion.html";
    return;
  }

  const titre = document.getElementById("titre").value.trim();
  const categorie = document.getElementById("categorie").value;
  const desc = document.getElementById("description").value.trim();
  const photoInput = document.getElementById("photo");
  const photoFile =
    photoInput && photoInput.files && photoInput.files[0]
      ? photoInput.files[0]
      : null;

  if (!titre || !desc) {
    alert(IDEE_TEXT.requiredFields);
    return;
  }

  let photoDataUrl = "";
  try {
    photoDataUrl = await readPhotoAsDataURL(photoFile);
  } catch (error) {
    alert(error.message || IDEE_TEXT.invalidPhoto);
    return;
  }

  const idee = {
    id: `ide_local_${Date.now()}`,
    user_id: profile.userId || "",
    user_nom: resolveCurrentUserName(),
    user_email: resolveCurrentUserEmail(),
    titre,
    categorie,
    description: desc,
    photo: photoDataUrl,
    likes: 0,
    timestamp: new Date().toISOString(),
  };

  submitIdeeWithFallback(idee, e.target);
}

async function submitIdeeWithFallback(idee, formEl) {
  const localValidationError = validateIdeePayload(idee);
  if (localValidationError) {
    alert(localValidationError);
    return;
  }

  // Envoi backend d'abord.
  const backendCreated = await createIdeeToBackend(idee);
  if (backendCreated.ok) {
    await loadIdeesFromBackend();
    formEl.reset();
    alert(IDEE_TEXT.createdBackend);
    return;
  }

  if (backendCreated.reachable) {
    alert(backendCreated.message || IDEE_TEXT.backendRefused);
    return;
  }

  alert(IDEE_TEXT.backendUnavailable);
}

async function loadIdeesFromBackend() {
  for (const endpoint of IDEES_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!resp.ok) continue;

      const data = unwrapApiListResponse(await resp.json());
      if (!data.length) continue;

      idees = data;
      renderIdees();
      return;
    } catch (e) {
      // On essaie un autre endpoint.
    }
  }
}

async function createIdeeToBackend(idee) {
  const payload = {
    titre: idee.titre,
    categorie: idee.categorie,
    description: idee.description,
    user_id: idee.user_id || String(readCurrentProfile().userId || ""),
    user_nom: idee.user_nom || resolveCurrentUserName(),
    user_email: idee.user_email || resolveCurrentUserEmail(),
    photo: idee.photo || "",
  };

  for (const endpoint of IDEES_ENDPOINTS) {
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
        return { ok: true, reachable: true, data: json?.data || idee };
      }

      return {
        ok: false,
        reachable: true,
        data: null,
        message: extractBackendErrorMessage(json),
      };
    } catch (e) {
      // On essaie un autre endpoint.
    }
  }

  return {
    ok: false,
    reachable: false,
    data: null,
    message: IDEE_TEXT.backendUnavailable,
  };
}

function renderIdees() {
  const container = document.getElementById("listeIdees");
  const profile = readCurrentProfile();
  const filteredIdees = getFilteredIdees();
  const totalEl = document.getElementById("totalIdees");
  if (totalEl) {
    totalEl.textContent = profile.connected
      ? String(filteredIdees.length)
      : "0";
  }

  if (container) {
    if (!profile.connected) {
      stopInfiniteScrollIdeesPage();
      container.innerHTML = `<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">${IDEE_TEXT.mustLoginToView}</p>`;
      return;
    }

    container.innerHTML =
      filteredIdees
        .map(
          (idee) => `
      <div class="carte-idee ${idee.photo ? "" : "no-photo"}">
        ${idee.photo ? `<img src="${idee.photo}" alt="Photo idée" class="carte-idee-photo">` : ""}
        <h3>${idee.titre}</h3>
        <p>${idee.description}</p>
        ${idee.user_nom ? `<p class="carte-idee-author">Par : ${idee.user_nom}</p>` : ""}
        ${renderIdeeCategoryBadge(idee.categorie)}
        ${renderIdeeStatusBadge()}
        <small>${new Date(idee.timestamp).toLocaleString()}</small>
        <div class="carte-actions">
          <button class="btn-like" type="button" disabled title="${IDEE_TEXT.likeOnCommunity}">
            <i class='bx bx-heart'></i> <span class="like-count">${getIdeeLikeCount(idee)}</span>
          </button>
          <button class="btn-delete-idee" onclick="deleteIdee('${idee.id || idee.timestamp}')">Supprimer</button>
        </div>
      </div>
    `,
        )
        .join("") || `<p>${IDEE_TEXT.noIdeasForAccount}</p>`;

    setupCarouselIdeesPage();
  }

  // totalIdees reflète uniquement les idées de l'utilisateur connecté et du filtre actif.
}

function setupCarouselIdeesPage() {
  const carousel = document.getElementById("listeIdees");
  const btnPrev = document.getElementById("carouselPrevIdeesPage");
  const btnNext = document.getElementById("carouselNextIdeesPage");

  if (!carousel) return;

  stopInfiniteScrollIdeesPage();
  prepareInfiniteCarouselIdeesPage(carousel);

  const baseCount = Number(carousel.dataset.baseCount || 0);
  const canScroll = baseCount > MIN_CARDS_FOR_AUTO_SCROLL;

  if (btnPrev) btnPrev.disabled = !canScroll;
  if (btnNext) btnNext.disabled = !canScroll;

  if (!canScroll) {
    carousel.scrollLeft = 0;
    return;
  }

  const step = getCardStepIdeesPage(carousel);

  if (btnPrev && btnPrev.dataset.bound !== "1") {
    btnPrev.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: -step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePositionIdeesPage(carousel), 380);
    });
    btnPrev.dataset.bound = "1";
  }

  if (btnNext && btnNext.dataset.bound !== "1") {
    btnNext.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePositionIdeesPage(carousel), 380);
    });
    btnNext.dataset.bound = "1";
  }

  if (carousel.dataset.hoverBound !== "1") {
    carousel.addEventListener("mouseover", (event) => {
      if (event.target.closest(".carte-idee")) {
        isHoverPaused = true;
      }
    });

    carousel.addEventListener("mouseout", (event) => {
      const leavingCard = event.target.closest(".carte-idee");
      const stillInsideCard = event.relatedTarget?.closest?.(".carte-idee");
      if (leavingCard && !stillInsideCard) {
        isHoverPaused = false;
      }
    });

    carousel.dataset.hoverBound = "1";
  }

  startInfiniteScrollIdeesPage(carousel);
}

function prepareInfiniteCarouselIdeesPage(carousel) {
  const originals = Array.from(carousel.querySelectorAll(".carte-idee"));
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

  const step = getCardStepIdeesPage(carousel);
  const span = step * originalCount;
  carousel.dataset.loopSpan = String(span);
  carousel.scrollLeft = span;
}

function getCardStepIdeesPage(carousel) {
  const cards = carousel.querySelectorAll(".carte-idee");
  if (cards.length >= 2) {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    if (step > 0) return step;
  }
  return 320;
}

function normalizeInfinitePositionIdeesPage(carousel) {
  const span = Number(carousel.dataset.loopSpan || 0);
  if (!span) return;

  if (carousel.scrollLeft >= span * 2) {
    carousel.scrollLeft -= span;
  } else if (carousel.scrollLeft < span * 0.5) {
    carousel.scrollLeft += span;
  }
}

function startInfiniteScrollIdeesPage(carousel) {
  stopInfiniteScrollIdeesPage();

  carouselIntervalId = setInterval(() => {
    if (!carousel.isConnected) return;

    if (!isHoverPaused && Date.now() >= pauseUntil) {
      carousel.scrollLeft += AUTO_SCROLL_STEP_PX;
      normalizeInfinitePositionIdeesPage(carousel);
    }
  }, AUTO_SCROLL_TICK_MS);
}

function stopInfiniteScrollIdeesPage() {
  if (carouselIntervalId) {
    clearInterval(carouselIntervalId);
    carouselIntervalId = null;
  }
}

async function deleteIdee(idOrTimestamp) {
  if (confirm(IDEE_TEXT.confirmDelete)) {
    const target = idees.find(
      (i) => String(i.id || i.timestamp) === String(idOrTimestamp),
    );

    if (!target || !isOwnedByCurrentUser(target)) {
      alert(IDEE_TEXT.deleteDenied);
      return;
    }

    if (target && target.id) {
      await deleteIdeeToBackend(target.id);
    }

    idees = idees.filter(
      (i) => String(i.id || i.timestamp) !== String(idOrTimestamp),
    );
    renderIdees();
  }
}

function clearIdees() {
  if (confirm(IDEE_TEXT.confirmClear)) {
    idees = idees.filter((idee) => !isOwnedByCurrentUser(idee));
    renderIdees();
  }
}

async function deleteIdeeToBackend(id) {
  for (const endpoint of IDEES_DELETE_ENDPOINTS) {
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
      // On essaie l'endpoint suivant.
    }
  }
  return false;
}
