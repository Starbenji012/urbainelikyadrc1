/* Fonction de navigation */
function goBack() {
  window.location.href = "./index.html";
}

/* CONNEXION.JS - VERSION SIMPLE */

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
