/**
 * Fonction pour retourner à la page précédente
 */
function goBack() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {
  const menuBurger = document.getElementById('menu-burger');
  const navigationMenu = document.querySelector('.navigation-menu');

  if (menuBurger && navigationMenu) {
    menuBurger.addEventListener('click', () => {
      navigationMenu.classList.toggle('active');
    });

    // Fermer le menu quand un lien est cliqué
    navigationMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navigationMenu.classList.remove('active');
      });
    });
  }

});
