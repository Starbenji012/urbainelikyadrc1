//Effet de scroll
const sr = ScrollReveal({
    reset: true,
    distance: '80px',
    duration: 2000,
    delay: 200,
});

sr.reveal('header,.navbar,.titre', { origin: 'top' });
sr.reveal('.footer-contenaire,.footer-bottom', { origin: 'bottom' });