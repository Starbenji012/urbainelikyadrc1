/* COMMUNAUTE.JS - VERSION CORRIGÉE */

/* GESTION MENU BURGER */
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
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener(
        "click",
        () => (
          navigationMenu.classList.remove("mobile-active"),
          updateBurgerIcon()
        ),
      );
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

// Données locales - VERSION PAGE COMMUNAUTÉ (LIKES SÉPARÉS)
let idees = JSON.parse(localStorage.getItem("idees_page") || "[]"); // Lecture depuis idées.js
let idees_communaute = idees.map((idee) => ({
  ...idee,
  likes:
    JSON.parse(localStorage.getItem("idees_communaute_likes") || "{}")[
      idee.timestamp
    ] || 0,
}));

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  renderIdees();
});

function renderIdees() {
  const ideesContainer = document.querySelector(".idees-container");
  if (ideesContainer) {
    ideesContainer.innerHTML =
      idees_communaute.length === 0
        ? "<p>Aucune idée.</p>"
        : idees_communaute
            .map(
              (idee, index) => `
      <div class="carte-idee">
        <h3>${idee.titre}</h3>
        <p>${idee.description}</p>
        <span class="categorie-badge">${idee.categorie}</span>
        <small>${new Date(idee.timestamp).toLocaleString()}</small>
        <div class="carte-actions">
          <button class="btn-like" onclick="communauteLikeIdee('${idee.timestamp}')">
            <i class='bx bx-heart'></i> <span class="like-count">${idee.likes || 0}</span>
          </button>
        </div>
      </div>
    `,
            )
            .join("");
  }
}

function communauteLikeIdee(timestamp) {
  const likes = JSON.parse(
    localStorage.getItem("idees_communaute_likes") || "{}",
  );
  likes[timestamp] = (likes[timestamp] || 0) + 1;
  localStorage.setItem("idees_communaute_likes", JSON.stringify(likes));

  // Mettre à jour l'affichage
  idees_communaute = idees.map((idee) => ({
    ...idee,
    likes: likes[idee.timestamp] || 0,
  }));
  renderIdees();
}
