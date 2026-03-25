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

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagée dans utils.js.
  initMenuBurger();
  renderIdees();
  loadIdeesFromBackend();
});

function renderIdees() {
  const ideesContainer = document.querySelector(".idees-container");
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
              <button class="btn-like" onclick="communauteLikeIdee('${idee.id || idee.timestamp}')">
                <i class='bx bx-heart'></i> <span class="like-count">${likesCommunaute[idee.id || idee.timestamp] || 0}</span>
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
  renderIdees();
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
      renderIdees();
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
