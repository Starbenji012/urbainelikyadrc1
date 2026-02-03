// Initialize or reuse shared ScrollReveal instance (avoids redeclaration when multiple scripts are loaded)
window._sr = window._sr || ScrollReveal({
    reset: true,
    distance: '80px',
    duration: 2000,
    delay: 200,
});

window._sr.reveal('header,.navbar,.retour-section,.titre-de-page,.carte-section,.signalement-wrap,.map-layout,.section-signalement-non-afficher-map,.retour', { origin: 'top' });

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

document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('btn-retour');
  if (btn && !btn._backInstalled) {
    btn.addEventListener('click', goBack);
    btn._backInstalled = true;
  }
});