/* COMMUNAUTE.JS - Affichage global des idées et signalements par statut */

const IDEES_ENDPOINTS = buildApiEndpoints("idees/index.php");
const SIGNALEMENTS_ENDPOINTS = buildApiEndpoints("signalements/index.php");
const IDEES_LIKE_ENDPOINTS = buildApiEndpoints("idees/like.php");

const COMMUNAUTE_TEXT = {
  noIdeas: "Aucune idée.",
  noResolvedIdeas: "Aucune idée réalisée.",
  noResolvedSignalements: "Aucun signalement résolu.",
};

let idees = [];
let signalements = [];

const MIN_CARDS_FOR_AUTO_SCROLL = 3;
const AUTO_SCROLL_STEP_PX = 1;
const AUTO_SCROLL_TICK_MS = 26;
const MANUAL_PAUSE_MS = 1400;

const carouselIntervals = new Map();
const carouselPauseUntil = new Map();

function normalizeStatus(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();
}

function isIdeeRealisee(idee) {
  return normalizeStatus(idee?.status) === "realisee";
}

function isSignalementResolu(sig) {
  return normalizeStatus(sig?.status) === "resolu";
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
      label: String(category || "Autre"),
      icon: "../icon-map/icons8-view-more-48.png",
    }
  );
}

function renderIdeeCategoryBadge(category) {
  const meta = getIdeeCategoryMeta(category);
  return `<span class="categorie-badge cat-${meta.key}"><img src="${meta.icon}" alt="${meta.label}" class="categorie-badge-icon">${meta.label}</span>`;
}

function renderIdeaCard(idee) {
  const key = String(idee.id || idee.timestamp || "");
  return `
    <div class="carte-idee ${idee.photo ? "" : "no-photo"}">
      ${idee.photo ? `<img src="${idee.photo}" alt="Photo idée" class="carte-idee-photo">` : ""}
      <h3>${idee.titre || "Idée"}</h3>
      <p>${idee.description || ""}</p>
      ${idee.user_nom ? `<p class="carte-idee-author">Par : ${idee.user_nom}</p>` : ""}
      ${renderIdeeCategoryBadge(idee.categorie)}
      <span class="idee-status-badge">${idee.status === "realisee" ? "Réalisée" : "En attente"}</span>
      <small>${idee.timestamp ? new Date(idee.timestamp).toLocaleString("fr-FR") : "Date inconnue"}</small>
      <div class="carte-actions">
        <button class="btn-like" data-like-key="${key}" onclick="communauteLikeIdee('${key}')">
          <i class='bx bx-heart'></i> <span class="like-count" data-like-key="${key}">${Number(idee.likes || 0)}</span>
        </button>
      </div>
    </div>
  `;
}

function getSignalementTypeLabel(typeValue) {
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

function renderSignalementCard(sig) {
  return `
    <div class="carte-signalement ${sig.photo ? "" : "no-photo"}">
      ${sig.photo ? `<img src="${sig.photo}" alt="Photo signalement" class="carte-signalement-photo">` : ""}
      <h3>${sig.titre || "Signalement"}</h3>
      <p class="carte-signalement-desc">${sig.description || ""}</p>
      <span class="carte-signalement-type">${getSignalementTypeLabel(sig.type)}</span>
      <span class="carte-signalement-status">${sig.status === "resolu" ? "Résolu" : "En attente"}</span>
      ${sig.user_nom ? `<p class="carte-signalement-author">Par : ${sig.user_nom}</p>` : ""}
      <p class="carte-signalement-location">📍 ${sig.lieu || "Adresse non spécifiée"}</p>
      <div class="carte-signalement-meta">${sig.timestamp ? new Date(sig.timestamp).toLocaleString("fr-FR") : "Date inconnue"}</div>
    </div>
  `;
}

function renderCards(containerId, items, emptyMessage, cardRenderer) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = items.length
    ? items.map(cardRenderer).join("")
    : `<p>${emptyMessage}</p>`;
}

function stopInfiniteScroll(containerId) {
  const intervalId = carouselIntervals.get(containerId);
  if (intervalId) {
    clearInterval(intervalId);
    carouselIntervals.delete(containerId);
  }
}

function normalizeInfinitePosition(carousel) {
  const span = Number(carousel.dataset.loopSpan || 0);
  if (!span) return;

  if (carousel.scrollLeft >= span * 2) {
    carousel.scrollLeft -= span;
  } else if (carousel.scrollLeft < span * 0.5) {
    carousel.scrollLeft += span;
  }
}

function getCardStep(carousel) {
  const cards = carousel.querySelectorAll(".carte-idee, .carte-signalement");
  if (cards.length >= 2) {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    if (step > 0) return step;
  }
  return 320;
}

function prepareInfiniteCarousel(containerId) {
  const carousel = document.getElementById(containerId);
  if (!carousel) return;

  stopInfiniteScroll(containerId);

  const originals = Array.from(
    carousel.querySelectorAll(".carte-idee, .carte-signalement"),
  );
  const originalCount = originals.length;
  carousel.dataset.baseCount = String(originalCount);

  if (originalCount < MIN_CARDS_FOR_AUTO_SCROLL) {
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

  const step = getCardStep(carousel);
  const span = step * originalCount;
  carousel.dataset.loopSpan = String(span);
  carousel.scrollLeft = span;
}

function startInfiniteScroll(containerId) {
  const carousel = document.getElementById(containerId);
  if (!carousel) return;

  stopInfiniteScroll(containerId);

  const intervalId = window.setInterval(() => {
    if (!carousel.isConnected) return;

    const pauseUntil = carouselPauseUntil.get(containerId) || 0;
    const hoverPaused = carousel.dataset.hoverPaused === "1";
    if (Date.now() < pauseUntil || hoverPaused) return;

    carousel.scrollLeft += AUTO_SCROLL_STEP_PX;
    normalizeInfinitePosition(carousel);
  }, AUTO_SCROLL_TICK_MS);

  carouselIntervals.set(containerId, intervalId);
}

function setupInfiniteCarousel(containerId, prevId, nextId) {
  const carousel = document.getElementById(containerId);
  const btnPrev = document.getElementById(prevId);
  const btnNext = document.getElementById(nextId);
  if (!carousel) return;

  prepareInfiniteCarousel(containerId);

  const baseCount = Number(carousel.dataset.baseCount || 0);
  if (baseCount < MIN_CARDS_FOR_AUTO_SCROLL) {
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) btnNext.disabled = true;
    return;
  }

  if (btnPrev && btnPrev.dataset.bound !== "1") {
    btnPrev.addEventListener("click", () => {
      carouselPauseUntil.set(containerId, Date.now() + MANUAL_PAUSE_MS);
      const step = getCardStep(carousel);
      carousel.scrollBy({ left: -step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePosition(carousel), 380);
    });
    btnPrev.dataset.bound = "1";
  }

  if (btnNext && btnNext.dataset.bound !== "1") {
    btnNext.addEventListener("click", () => {
      carouselPauseUntil.set(containerId, Date.now() + MANUAL_PAUSE_MS);
      const step = getCardStep(carousel);
      carousel.scrollBy({ left: step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePosition(carousel), 380);
    });
    btnNext.dataset.bound = "1";
  }

  if (carousel.dataset.hoverBound !== "1") {
    carousel.addEventListener("mouseover", (event) => {
      if (event.target.closest(".carte-idee, .carte-signalement")) {
        carousel.dataset.hoverPaused = "1";
      }
    });

    carousel.addEventListener("mouseout", (event) => {
      const leavingCard = event.target.closest(
        ".carte-idee, .carte-signalement",
      );
      const stillInsideCard = event.relatedTarget?.closest?.(
        ".carte-idee, .carte-signalement",
      );
      if (leavingCard && !stillInsideCard) {
        carousel.dataset.hoverPaused = "0";
      }
    });

    carousel.dataset.hoverBound = "1";
  }

  startInfiniteScroll(containerId);
}

function setupSimpleCarousel(containerId, prevId, nextId) {
  const carousel = document.getElementById(containerId);
  const btnPrev = document.getElementById(prevId);
  const btnNext = document.getElementById(nextId);
  if (!carousel) return;

  const step = 320;

  if (btnPrev && btnPrev.dataset.bound !== "1") {
    btnPrev.addEventListener("click", () => {
      carousel.scrollBy({ left: -step, behavior: "smooth" });
    });
    btnPrev.dataset.bound = "1";
  }

  if (btnNext && btnNext.dataset.bound !== "1") {
    btnNext.addEventListener("click", () => {
      carousel.scrollBy({ left: step, behavior: "smooth" });
    });
    btnNext.dataset.bound = "1";
  }
}

async function loadIdeasFromBackend() {
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
      return;
    } catch (e) {}
  }
}

async function loadSignalementsFromBackend() {
  for (const endpoint of SIGNALEMENTS_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!resp.ok) continue;

      const data = unwrapApiListResponse(await resp.json());
      if (!data.length) continue;

      signalements = data;
      return;
    } catch (e) {}
  }
}

async function communauteLikeIdee(idOrTimestamp) {
  if (!idOrTimestamp) return;

  const target = idees.find(
    (i) => String(i.id || i.timestamp) === String(idOrTimestamp),
  );
  if (target && target.id) {
    await likeIdeeToBackend(target.id);
  }

  await loadIdeasFromBackend();
  renderCommunitySections();
}

async function likeIdeeToBackend(id) {
  for (const endpoint of IDEES_LIKE_ENDPOINTS) {
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
    } catch (e) {}
  }
  return false;
}

function renderCommunitySections() {
  renderCards(
    "ideesCarouselSoumises",
    idees,
    COMMUNAUTE_TEXT.noIdeas,
    renderIdeaCard,
  );
  renderCards(
    "ideesCarouselRealisees",
    idees.filter(isIdeeRealisee),
    COMMUNAUTE_TEXT.noResolvedIdeas,
    renderIdeaCard,
  );
  renderCards(
    "signalementsCarouselResolus",
    signalements.filter(isSignalementResolu),
    COMMUNAUTE_TEXT.noResolvedSignalements,
    renderSignalementCard,
  );

  setupInfiniteCarousel(
    "ideesCarouselSoumises",
    "carouselPrevIdeesSoumises",
    "carouselNextIdeesSoumises",
  );
  setupSimpleCarousel(
    "ideesCarouselRealisees",
    "carouselPrevIdeesRealisees",
    "carouselNextIdeesRealisees",
  );
  setupInfiniteCarousel(
    "signalementsCarouselResolus",
    "carouselPrevSignalementsResolus",
    "carouselNextSignalementsResolus",
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  loadIdeasFromBackend()
    .then(loadSignalementsFromBackend)
    .then(renderCommunitySections);
});
