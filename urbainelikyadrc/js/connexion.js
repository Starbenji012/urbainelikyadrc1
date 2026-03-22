/* Fonction de navigation */
function goBack() {
  window.location.href = "./index.html";
}

/* CONNEXION.JS - VERSION INITIALE BASIQUE */

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

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  const formConnexion = document.getElementById("formCon");
  if (formConnexion) {
    formConnexion.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      if (email && password) {
        alert("Connexion réussie ! (simulation)");
        window.location.href = "index.html";
      } else {
        alert("Veuillez remplir tous les champs");
      }
    });
  }

  // Switch forms
  document.querySelectorAll(".Switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".form")
        .forEach((f) => f.classList.toggle("active"));
    });
  });
});
