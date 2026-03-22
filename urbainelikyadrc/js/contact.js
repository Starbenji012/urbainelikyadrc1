/* CONTACT.JS - VERSION SIMPLE */

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  // Formulaire de contact: validation simple côté navigateur.
  const formContact = document.getElementById("formcont");
  if (formContact) {
    formContact.addEventListener("submit", (e) => {
      e.preventDefault();
      // Lire les champs saisis.
      const nom = document.getElementById("nom").value;
      const email = document.getElementById("email").value;
      const sujet = document.getElementById("sujet").value;
      const message = document.getElementById("message").value;

      // Si tout est rempli, on simule un envoi puis on vide le formulaire.
      if (nom && email && sujet && message) {
        alert("Message envoyé (simulation) !");
        formContact.reset();
      } else {
        alert("Veuillez remplir tous les champs");
      }
    });
  }
});
