

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

// --- Form handling: ajouter un témoignage depuis la page d'accueil ---
function initTemoignageForm() {
    const btnAdd = document.getElementById('btn-add-temoignage');
    const form = document.getElementById('form-temoignage');
    const inputNom = document.getElementById('temoignage-nom');
    const inputVille = document.getElementById('temoignage-ville');
    const inputMessage = document.getElementById('temoignage-message');
    const inputPhoto = document.getElementById('temoignage-photo');
    const preview = document.getElementById('temoignage-preview');
    const btnCancel = document.getElementById('btn-cancel-temoignage');
    const feedback = document.getElementById('temoignage-feedback');

    if (!btnAdd || !form) return;

    // Afficher / masquer le formulaire
    btnAdd.addEventListener('click', () => {
        form.style.display = form.style.display === 'none' ? 'block' : 'none';
        feedback.textContent = '';
    });

    // Annuler
    if (btnCancel) btnCancel.addEventListener('click', () => {
        form.style.display = 'none';
        clearForm();
        feedback.textContent = '';
    });

    // Prévisualiser la photo
    if (inputPhoto) inputPhoto.addEventListener('change', () => {
        if (!preview) return;
        preview.innerHTML = '';
        const file = inputPhoto.files && inputPhoto.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.maxWidth = '100px';
            img.style.borderRadius = '6px';
            img.alt = 'Aperçu';
            preview.appendChild(img);
        };
        reader.readAsDataURL(file);
    });

    // Soumettre le formulaire
    form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        if (!inputMessage) return;
        const nom = (inputNom && inputNom.value || '').trim();
        const ville = (inputVille && inputVille.value || '').trim();
        const message = (inputMessage && inputMessage.value || '').trim();
        if (!message) {
            if (feedback) { feedback.style.color = 'red'; feedback.textContent = 'Le message est requis.'; }
            showToast('Le message est requis.', 'error');
            return;
        }
        if (feedback) { feedback.style.color = 'green'; feedback.textContent = 'Envoi en cours...'; }
        let photoData = '';
        const file = inputPhoto && inputPhoto.files && inputPhoto.files[0];
        if (file) {
            try {
                photoData = await fileToDataURL(file);
            } catch (err) {
                photoData = '';
                showToast('Impossible de lire la photo.', 'error');
            }
        }

        const temoignages = JSON.parse(localStorage.getItem('temoignages') || '[]');
        temoignages.unshift({
            nom: nom || 'Anonyme',
            ville: ville || 'Kinshasa',
            message,
            photo: photoData || '../img/logo.png',
            ts: Date.now()
        });
        localStorage.setItem('temoignages', JSON.stringify(temoignages));
        loadTemoignages();

        if (feedback) { feedback.style.color = 'green'; feedback.textContent = 'Merci ! Votre témoignage a été ajouté.'; }
        showToast('Merci ! Votre témoignage a été ajouté.', 'success');
        clearForm();
        form.style.display = 'none';
    });

    function clearForm() {
        if (inputNom) inputNom.value = '';
        if (inputVille) inputVille.value = '';
        if (inputMessage) inputMessage.value = '';
        if (inputPhoto) inputPhoto.value = '';
        if (preview) preview.innerHTML = '';
    }
}

function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Erreur lecture fichier'));
        reader.readAsDataURL(file);
    });
}

// Petite notification toast
function showToast(message, type = 'success', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'toast ' + (type === 'error' ? 'error' : 'success');
    t.textContent = message;
    container.appendChild(t);
    // force reflow pour activer la transition
    void t.offsetWidth;
    t.classList.add('show');
    setTimeout(() => {
        t.classList.remove('show');
        setTimeout(() => { try { container.removeChild(t); } catch (_) {} }, 240);
    }, duration);
}

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
function initMenuBurger() {
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
}


// Initialiser le gestionnaire de formulaire et menu au chargement
document.addEventListener('DOMContentLoaded', () => {
    initTemoignageForm();
    initMenuBurger();
});