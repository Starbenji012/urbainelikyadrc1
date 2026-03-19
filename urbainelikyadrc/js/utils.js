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
    menuBurger.addEventListener("click", () => {
      navigationMenu.classList.toggle("mobile-active");
    });
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () =>
        navigationMenu.classList.remove("mobile-active"),
      );
    });
  }
}
