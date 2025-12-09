// Initialize ScrollReveal correctly and reuse the instance
const sr = ScrollReveal({
    reset: true,
    distance: '80px',
    duration: 2000,
    delay: 200,
});

sr.reveal('header,.navbar,.hero-bg,.hero-overlay, .hero-content, .presentation, .fonctionnement,.statistique-resultat,.temoignages-Avis,.temoignages-Avis h2', { origin: 'top' });
sr.reveal('.hero-buttons,.footer-contenaire,.footer-bottom', { origin: 'bottom' });