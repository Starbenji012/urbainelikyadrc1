/**
 * Fonction pour retourner à la page précédente
 */
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = "index.html";
  }
}

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
});
