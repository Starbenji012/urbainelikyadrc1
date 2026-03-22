/* Fonction de navigation */
function goBack() {
  window.location.href = "./index.html";
}

/* INSCRIPTION.JS - VERSION SIMPLE */

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
