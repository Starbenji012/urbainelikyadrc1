/* COMMUNAUTE.JS - Affichage global et likes communautaires */

const IDEES_ENDPOINTS = [
  "/backend/api/idees/index.php",
  "../backend/api/idees/index.php",
  "backend/api/idees/index.php",
];

const IDEES_LIKE_ENDPOINTS = [
  "/backend/api/idees/like.php",
  "../backend/api/idees/like.php",
  "backend/api/idees/like.php",
];

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

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagée dans utils.js.
  initMenuBurger();

  // Charger depuis le backend ou initialiser avec des données de test
  loadIdeesFromBackend().then(() => {
    // Si aucune donnée après le backend, utiliser des données de test
    if (idees.length === 0) {
      initializeTestData();
    }
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
        ? "<p>Aucune idée.</p>"
        : idees
            .map(
              (idee) => `
      <div class="carte-idee ${idee.photo ? "" : "no-photo"}">
        ${idee.photo ? `<img src="${idee.photo}" alt="Photo idée" class="carte-idee-photo">` : ""}
        <h3>${idee.titre}</h3>
        <p>${idee.description}</p>
        ${idee.user_nom ? `<p class="carte-idee-author">Par : ${idee.user_nom}</p>` : ""}
        <span class="categorie-badge">${idee.categorie}</span>
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

function initializeTestData() {
  idees = [
    {
      id: 1,
      titre: "Améliorer les espaces verts",
      description: "Créer plus de parcs et jardins publics pour les habitants.",
      categorie: "Environnement",
      user_nom: "Jean",
      timestamp: new Date().toISOString(),
    },
    {
      id: 2,
      titre: "Transport en commun écologique",
      description: "Implémenter un système de bus électriques dans la ville.",
      categorie: "Transport",
      user_nom: "Marie",
      timestamp: new Date().toISOString(),
    },
    {
      id: 3,
      titre: "Zones piétonnes sécurisées",
      description: "Développer des avenues sans voitures pour les piétons.",
      categorie: "Urbanisme",
      user_nom: "Paul",
      timestamp: new Date().toISOString(),
    },
    {
      id: 4,
      titre: "Éclairage public moderne",
      description: "Remplacer l'ancienne signalétique par des LED.",
      categorie: "Infrastructure",
      user_nom: "Sophie",
      timestamp: new Date().toISOString(),
    },
    {
      id: 5,
      titre: "Gestion des déchets efficace",
      description: "Mettre en place un système de recyclage communautaire.",
      categorie: "Environnement",
      user_nom: "Luc",
      timestamp: new Date().toISOString(),
    },
  ];
  localStorage.setItem("idees_page", JSON.stringify(idees));
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
