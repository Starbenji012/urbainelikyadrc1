/* Fonction de navigation */
function goBack() {
  window.location.href = "./index.html";
}

/* INSCRIPTION.JS - VERSION INITIALE BASIQUE */

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

  const formInscription = document.getElementById("formIns");
  if (formInscription) {
    formInscription.addEventListener("submit", (e) => {
      e.preventDefault();
      const nom = document.getElementById("nom").value;
      const prenom = document.getElementById("prenom").value;
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      if (nom && prenom && email && password) {
        alert("Inscription réussie ! Redirection vers connexion.");
        window.location.href = "connexion.html";
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
