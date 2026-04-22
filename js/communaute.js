/* COMMUNAUTE.JS - Affichage global et likes communautaires */

const IDEES_ENDPOINTS = buildApiEndpoints("idees/index.php");

const IDEES_LIKE_ENDPOINTS = buildApiEndpoints("idees/like.php");

const COMMUNAUTE_TEXT = {
  noIdeas: "Aucune idée.",
};

// Données locales des idées.
let idees = JSON.parse(localStorage.getItem("idees_page") || "[]");

// Likes communautaires séparés de la page Idées.
let likesCommunaute = JSON.parse(
  localStorage.getItem("idees_communaute_likes") || "{}",
);

// Variables pour le carrousel
const MIN_CARDS_FOR_AUTO_SCROLL = 3; // Défilement seulement si > 3 cartes
const AUTO_SCROLL_STEP_PX = 1; // Pas fixe pour éviter le tremblement du texte
const AUTO_SCROLL_TICK_MS = 26; // ~38px/s, vitesse moyenne
const MANUAL_PAUSE_MS = 1400;

let carouselIntervalId = null;
let pauseUntil = 0;
let isHoverPaused = false;

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

function renderIdeeStatusBadge() {
  return '<span class="idee-status-badge">En attente</span>';
}

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagée dans utils.js.
  initMenuBurger();

  // Charger les idées depuis le backend, puis afficher la page.
  loadIdeesFromBackend().then(() => {
    renderIdees();
    setupCarousel();
  });
});

function setupCarousel() {
  const carousel = document.getElementById("ideesCarousel");
  const btnPrev = document.getElementById("carouselPrev");
  const btnNext = document.getElementById("carouselNext");

  if (!carousel) return;

  stopInfiniteScroll();
  prepareInfiniteCarousel(carousel);

  const baseCount = Number(carousel.dataset.baseCount || 0);
  if (baseCount <= MIN_CARDS_FOR_AUTO_SCROLL) {
    carousel.scrollLeft = 0;
    return;
  }

  const step = getCardStep(carousel);

  if (btnPrev && btnPrev.dataset.bound !== "1") {
    btnPrev.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: -step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePosition(carousel), 380);
    });
    btnPrev.dataset.bound = "1";
  }

  if (btnNext && btnNext.dataset.bound !== "1") {
    btnNext.addEventListener("click", () => {
      pauseUntil = Date.now() + MANUAL_PAUSE_MS;
      carousel.scrollBy({ left: step, behavior: "smooth" });
      setTimeout(() => normalizeInfinitePosition(carousel), 380);
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

  startInfiniteScroll(carousel);
}

function prepareInfiniteCarousel(carousel) {
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

  const step = getCardStep(carousel);
  const span = step * originalCount;
  carousel.dataset.loopSpan = String(span);
  carousel.scrollLeft = span;
}

function getCardStep(carousel) {
  const cards = carousel.querySelectorAll(".carte-idee");
  if (cards.length >= 2) {
    const step = cards[1].offsetLeft - cards[0].offsetLeft;
    if (step > 0) return step;
  }
  return 320;
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

function startInfiniteScroll(carousel) {
  stopInfiniteScroll();

  carouselIntervalId = setInterval(() => {
    if (!carousel.isConnected) return;

    if (!isHoverPaused && Date.now() >= pauseUntil) {
      carousel.scrollLeft += AUTO_SCROLL_STEP_PX;
      normalizeInfinitePosition(carousel);
    }
  }, AUTO_SCROLL_TICK_MS);
}

function stopInfiniteScroll() {
  if (carouselIntervalId) {
    clearInterval(carouselIntervalId);
    carouselIntervalId = null;
  }
}

function renderIdees() {
  const ideesContainer = document.getElementById("ideesCarousel");
  if (ideesContainer) {
    ideesContainer.innerHTML =
      idees.length === 0
        ? `<p>${COMMUNAUTE_TEXT.noIdeas}</p>`
        : idees
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
              <button class="btn-like" data-like-key="${idee.id || idee.timestamp}" onclick="communauteLikeIdee('${idee.id || idee.timestamp}')">
                <i class='bx bx-heart'></i> <span class="like-count" data-like-key="${idee.id || idee.timestamp}">${likesCommunaute[idee.id || idee.timestamp] || 0}</span>
          </button>
        </div>
      </div>
    `,
            )
            .join("");
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

  likesCommunaute[idOrTimestamp] = (likesCommunaute[idOrTimestamp] || 0) + 1;
  localStorage.setItem(
    "idees_communaute_likes",
    JSON.stringify(likesCommunaute),
  );

  // Met à jour uniquement les compteurs correspondants sans re-render le carrousel.
  const nextValue = String(likesCommunaute[idOrTimestamp]);
  const counts = document.querySelectorAll(
    `.like-count[data-like-key="${idOrTimestamp}"]`,
  );
  counts.forEach((el) => {
    el.textContent = nextValue;
  });
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

      const data = await resp.json();
      if (!Array.isArray(data)) continue;

      idees = data;
      localStorage.setItem("idees_page", JSON.stringify(idees));
      return;
    } catch (e) {
      // On essaie le prochain endpoint.
    }
  }
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
    } catch (e) {
      // Fallback local deja gere.
    }
  }
  return false;
}
