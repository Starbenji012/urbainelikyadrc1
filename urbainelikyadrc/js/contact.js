/* CONTACT.JS - VERSION INITIALE BASIQUE */

/* GESTION MENU BURGER */
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

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  const formContact = document.getElementById("formcont");
  if (formContact) {
    formContact.addEventListener("submit", (e) => {
      e.preventDefault();
      const nom = document.getElementById("nom").value;
      const email = document.getElementById("email").value;
      const sujet = document.getElementById("sujet").value;
      const message = document.getElementById("message").value;
      if (nom && email && sujet && message) {
        alert("Message envoyé (simulation) !");
        formContact.reset();
      } else {
        alert("Veuillez remplir tous les champs");
      }
    });
  }
});
