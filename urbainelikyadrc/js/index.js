// Initialize ScrollReveal correctly and reuse the instance
const sr = ScrollReveal({
    reset: true,
    distance: '80px',
    duration: 2000,
    delay: 200,
});

sr.reveal('header,.navbar,.hero-bg,.hero-overlay, .hero-content, .presentation, .fonctionnement,.statistique-resultat,.temoignages-Avis,.temoignages-Avis h2', { origin: 'top' });
sr.reveal('.hero-buttons,.footer-contenaire,.footer-bottom', { origin: 'bottom' });

/* ============================================
   CHARGEMENT AUTOMATIQUE DES STATS ET TÉMOIGNAGES
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
    // Charger et afficher les statistiques
    loadStatistiques();
    // Charger et afficher les témoignages
    loadTemoignages();
});

/**
 * Charge les statistiques depuis le localStorage
 * (signalements et idées)
 */
function loadStatistiques() {
    // Récupérer les signalements
    const signalements = JSON.parse(localStorage.getItem('signalements') || '[]');
    const idees = JSON.parse(localStorage.getItem('idees') || '[]');
    
    // Compter les signalements
    const totalSignalements = signalements.length;
    const enCours = signalements.filter(s => s.etat === 'en_cours').length;
    const resolus = signalements.filter(s => s.etat === 'resolus').length;
    const totalIdees = idees.length;
    
    // Mettre à jour les éléments HTML
    const elSigTotal = document.getElementById('sig-total');
    const elSigEnCours = document.getElementById('sig-en-cours');
    const elSigResolus = document.getElementById('sig-resolus');
    const elIdees = document.getElementById('idees-soumis');
    
    if (elSigTotal) elSigTotal.textContent = totalSignalements;
    if (elSigEnCours) elSigEnCours.textContent = enCours;
    if (elSigResolus) elSigResolus.textContent = resolus;
    if (elIdees) elIdees.textContent = totalIdees;
}

/**
 * Charge et affiche les témoignages
 */
function loadTemoignages() {
    const temoignages = JSON.parse(localStorage.getItem('temoignages') || '[]');
    const container = document.querySelector('.temoignages-contenaire');
    
    if (!container) return;
    
    // Vider le conteneur existant (garder juste la structure)
    container.innerHTML = '';
    
    // Si pas de témoignages, afficher un message
    if (temoignages.length === 0) {
        container.innerHTML = '<p style="text-align: center; padding: 20px; color: #666;">Aucun témoignage pour le moment. Soyez le premier à partager !</p>';
        return;
    }
    
    // Créer les cartes de témoignages
    const fragment = document.createDocumentFragment();
    temoignages.forEach(temoignage => {
        const card = document.createElement('div');
        card.className = 'temoignages-cards';
        card.innerHTML = `
            <div class="left-border"></div>
            <div class="content">
                <p class="message">"${temoignage.message || ''}"</p>
                <div class="user-info">
                    <h4 class="name">${temoignage.nom || 'Anonyme'}</h4>
                    <p class="city">${temoignage.ville || 'Kinshasa'}</p>
                </div>
            </div>
            <img src="${temoignage.photo || '../img/logo.png'}" alt="photo utilisateur" class="profile-picture">
        `;
        fragment.appendChild(card);
    });
    
    container.appendChild(fragment);
}