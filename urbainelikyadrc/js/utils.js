/* UTILS.JS - Fonctions Partagées */

/* Fonction de navigation */
function goBack() {
  window.location.href = "./index.html";
}

/* GESTION MENU BURGER - Fonction Partagée */
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
