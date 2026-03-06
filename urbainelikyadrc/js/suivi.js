

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

/* ============================================
   INITIALISATION CARTE ET SIGNALEMENTS
   ============================================ */
let map;
let markers = [];
let signalements = [];
let currentFilter = null;

document.addEventListener('DOMContentLoaded', () => {
  // Initialiser le menu burger
  initMenuBurger();

  // Initialiser le bouton retour
  const btn = document.getElementById('btn-retour');
  if (btn && !btn._backInstalled) {
    btn.addEventListener('click', goBack);
    btn._backInstalled = true;
  }

  // Charger les signalements depuis localStorage
  signalements = JSON.parse(localStorage.getItem('signalements') || '[]');
  
  // Initialiser la carte
  initMap();
  
  // Afficher les signalements
  loadAndDisplaySignalements();

  // Ajouter les écouteurs de filtrage
  addFilterListeners();

  // Ajouter l'écouteur pour le bouton "Afficher tous"
  const btnShowAll = document.getElementById('btn-show-all');
  if (btnShowAll) {
    btnShowAll.addEventListener('click', () => setFilter(null));
  }
});

/**
 * Initialise la carte Leaflet
 */
function initMap() {
  try {
    // Créer la carte centrée sur Kinshasa
    map = L.map('map').setView([-4.0383, 21.7587], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
  } catch (e) {
    console.error('Erreur lors de l\'initialisation de la carte:', e);
  }
}

/**
 * Charge et affiche les signalements sur la carte
 */
function loadAndDisplaySignalements() {
  // Nettoyer les marqueurs existants
  markers.forEach(m => {
    try { map.removeLayer(m); } catch (e) {}
  });
  markers = [];

  // Ajouter les marqueurs pour chaque signalement
  signalements.forEach(sig => {
    addMarkerToMap(sig);
  });

  // Afficher la liste des signalements
  renderSignalementsList();

  // Mettre à jour les compteurs
  updateCounters();
}

/**
 * Ajoute un marqueur à la carte
 */
function addMarkerToMap(sig) {
  if (!map || !sig.lat || !sig.lng) return;

  const icon = getIconForType(sig.type);
  const m = icon 
    ? L.marker([sig.lat, sig.lng], { icon: icon }).addTo(map)
    : L.marker([sig.lat, sig.lng]).addTo(map);

  // Créer le contenu du popup
  let popupContent = '<div class="carte-signalement popup-signalement">';
  if (sig.photo) {
    popupContent += '<img src="' + sig.photo + '" alt="' + (sig.titre || 'Signalement') + '" class="carte-signalement-photo">';
  }
  popupContent += '<h3>' + (sig.titre || 'Signalement') + '</h3>';
  popupContent += '<p class="carte-signalement-desc">' + (sig.description || '') + '</p>';
  if (sig.type) popupContent += '<span class="carte-signalement-type">' + sig.type + '</span>';
  if (sig.timestamp) {
    try { 
      const dateStr = new Date(sig.timestamp).toLocaleString('fr-FR');
      popupContent += '<div class="carte-signalement-meta">' + dateStr + '</div>'; 
    } catch (e) {}
  }
  popupContent += '</div>';

  m.bindPopup(popupContent);
  m._sigType = (sig.type || '').toLowerCase();
  m._sigTimestamp = sig.timestamp;
  markers.push(m);
}

/**
 * Obtient l'icône appropriée selon le type
 */
function getIconForType(typeValue) {
  const iconBasePath = '../icon-map/';
  
  const icons = {
    'voirie': { url: iconBasePath + 'icons8-route-48.png', size: [48, 48] },
    'eau': { url: iconBasePath + 'icons8-eau-48.png', size: [48, 48] },
    'electricite': { url: iconBasePath + 'icons8-électricité-32.png', size: [32, 32] },
    'insecurite': { url: iconBasePath + 'icons8-protection-du-trou-de-serrure-48.png', size: [48, 48] },
    'dechet': { url: iconBasePath + 'icons8-corbeille-48.png', size: [48, 48] }
  };

  const key = (typeValue || '').toLowerCase();
  const config = icons[key];
  
  if (!config) return null;
  
  const size = config.size;
  return L.icon({
    iconUrl: config.url,
    iconSize: size,
    iconAnchor: [size[0] / 2, size[1]],
    popupAnchor: [0, -size[1]]
  });
}

/**
 * Ajoute les écouteurs pour les icônes de filtrage
 */
function addFilterListeners() {
  document.querySelectorAll('.filter-icon').forEach(img => {
    img.addEventListener('click', () => {
      const type = img.dataset.type;
      if (!type) return;
      
      if (currentFilter === type.toLowerCase()) {
        setFilter(null);
      } else {
        setFilter(type);
      }
    });
  });
}

/**
 * Définit le filtre courant
 */
function setFilter(type) {
  currentFilter = type ? String(type).toLowerCase() : null;
  
  // Mettre à jour l'affichage du filtre actif
  const af = document.getElementById('activeFilter');
  if (af) af.textContent = currentFilter ? currentFilter : 'Tous';

  // Mettre en évidence les icônes de filtre
  document.querySelectorAll('.filter-icon').forEach(img => {
    const isActive = currentFilter && img.dataset.type && 
                    img.dataset.type.toLowerCase() === currentFilter;
    img.classList.toggle('active-filter', isActive);
  });

  // Mettre à jour la visibilité des marqueurs
  updateMarkersVisibility();
  
  // Rafraîchir la liste
  renderSignalementsList();
  
  // Mettre à jour les compteurs
  updateCounters();
}

/**
 * Met à jour la visibilité des marqueurs selon le filtre
 */
function updateMarkersVisibility() {
  markers.forEach(m => {
    const t = String(m._sigType || '').toLowerCase();
    const show = !currentFilter || (t === currentFilter);
    
    try {
      if (show && !map.hasLayer(m)) {
        map.addLayer(m);
      } else if (!show && map.hasLayer(m)) {
        map.removeLayer(m);
      }
    } catch (e) {}
  });
}

/**
 * Affiche la liste des signalements
 */
function renderSignalementsList() {
  const container = document.getElementById('listeSignalements');
  if (!container) return;

  container.innerHTML = '';

  const filtered = signalements.filter(s => 
    !currentFilter || (s.type && s.type.toLowerCase() === currentFilter)
  );

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Aucun signalement.</p>';
    return;
  }

  const frag = document.createDocumentFragment();

  filtered.forEach(sig => {
    const card = document.createElement('div');
    card.className = 'carte-signalement';
    card.dataset.ts = sig.timestamp;

    if (sig.photo) {
      const img = document.createElement('img');
      img.src = sig.photo;
      img.alt = sig.titre;
      img.className = 'carte-signalement-photo';
      card.appendChild(img);
    }

    const h3 = document.createElement('h3');
    h3.textContent = sig.titre;
    card.appendChild(h3);

    const desc = document.createElement('p');
    desc.className = 'carte-signalement-desc';
    desc.textContent = sig.description;
    card.appendChild(desc);

    if (sig.type) {
      const type = document.createElement('span');
      type.className = 'carte-signalement-type';
      type.textContent = sig.type.charAt(0).toUpperCase() + sig.type.slice(1);
      card.appendChild(type);
    }

    const location = document.createElement('p');
    location.className = 'carte-signalement-location';
    location.textContent = '📍 ' + (sig.lieu || 'Adresse non spécifiée');
    card.appendChild(location);

    const meta = document.createElement('div');
    meta.className = 'carte-signalement-meta';
    if (sig.timestamp) {
      try {
        const dt = new Date(sig.timestamp).toLocaleString('fr-FR');
        meta.textContent = dt;
      } catch (e) {
        meta.textContent = 'Date inconnue';
      }
    }
    card.appendChild(meta);

    const btnContainer = document.createElement('div');
    btnContainer.className = 'carte-signalement-buttons';

    const btnVoirCarte = document.createElement('button');
    btnVoirCarte.type = 'button';
    btnVoirCarte.className = 'btn-voir-carte';
    btnVoirCarte.textContent = 'Voir sur carte';
    btnVoirCarte.addEventListener('click', () => {
      if (map) {
        map.flyTo([sig.lat, sig.lng], 16, { duration: 1.2 });
      }
    });

    btnContainer.appendChild(btnVoirCarte);
    card.appendChild(btnContainer);

    frag.appendChild(card);
  });

  container.appendChild(frag);
}

/**
 * Met à jour les compteurs
 */
function updateCounters() {
  const totalEl = document.getElementById('totalSignalements');
  if (totalEl) {
    totalEl.textContent = String(signalements.length || 0);
  }

  const filteredCountEl = document.getElementById('totalSignalementsAfficheAll');
  if (filteredCountEl) {
    const filtered = signalements.filter(s =>
      !currentFilter || (s.type && s.type.toLowerCase() === currentFilter)
    );
    filteredCountEl.textContent = String(filtered.length || 0);
  }
}

