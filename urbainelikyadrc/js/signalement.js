
const sr = ScrollReveal({
    reset: true,
    distance: '80px',
    duration: 2000,
    delay: 200,
});

sr.reveal('header,.navbar,.titre,.guide-rapide,.signalement-wrap,.remerciement', { origin: 'top' });
sr.reveal('.footer-contenaire,.footer-bottom', { origin: 'bottom' });


// Initialise la carte (centrée sur Kinshasa)
const map = L.map('map').setView([-4.0383, 21.7587], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Charger les signalements sauvegardés au démarrage de la page
document.addEventListener('DOMContentLoaded', () => {
    loadSignalements();
});

// Après chargement, attacher gestionnaires UI pour total / vider / suppression
document.addEventListener('DOMContentLoaded', () => {
    updateTotalSignalements();
    const btnVider = document.getElementById('btnViderSignalements');
    if (btnVider) {
        btnVider.addEventListener('click', () => {
            if (!signalements.length) return showMessage("Il n'y a aucun signalement à supprimer.", 'error');
            if (confirm('Voulez-vous vraiment supprimer tous les signalements ?')) {
                // remove markers
                markers.forEach(m => { try { map.removeLayer(m); } catch (_) {} });
                markers.length = 0;
                signalements.length = 0;
                saveSignalements();
                updateTotalSignalements();
                showMessage('Tous les signalements ont été supprimés.', 'success');
            }
        });
    }

    // délégation pour bouton supprimer dans popup
    document.addEventListener('click', (ev) => {
        const t = ev.target;
        if (t && t.classList && t.classList.contains('btn-delete-sig')) {
            const ts = t.dataset.ts;
            if (!ts) return;
            if (!confirm('Supprimer ce signalement ?')) return;
            deleteSignalement(ts);
        }
    });
});

// Liste de marqueurs ajoutés
const markers = [];

// Liste des signalements sauvegardés
const signalements = JSON.parse(localStorage.getItem('signalements') || '[]');

// Dernière position cliquée sur la carte
let lastLatLng = null;
let clickMarker = null; 

// Quand l'utilisateur clique sur la carte, on mémorise la position
map.on('click', function (e) {
    lastLatLng = e.latlng;
    const lieuInput = document.getElementById('lieu');
    if (lieuInput) {
        // show lat,lng immediately while reverse geocoding runs
        lieuInput.value = e.latlng.lat.toFixed(6) + ', ' + e.latlng.lng.toFixed(6);
        // try to get a human readable address and set it in the input
        reverseGeocode(e.latlng.lat, e.latlng.lng).then(addr => {
            if (addr) lieuInput.value = addr;
        }).catch(() => {/* ignore errors silently */});
    }

    // affiche ou déplace un marker temporaire
    if (clickMarker) {
        clickMarker.setLatLng(e.latlng);
    } else {
        clickMarker = L.marker(e.latlng).addTo(map);
    }
});

// Définition des icônes (paths relatifs corrects depuis la page HTML)
const iconBasePath = '../icon-map/';
const iconSecurite = L.icon({
    iconUrl: iconBasePath + 'icons8-protection-du-trou-de-serrure-48.png',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -40]
});
const iconVoirie = L.icon({
    iconUrl: iconBasePath + 'icons8-route-48.png',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -40]
});
const iconEau = L.icon({
    iconUrl: iconBasePath + 'icons8-eau-48.png',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -40]
});
const iconElectricite = L.icon({
    iconUrl: iconBasePath + 'icons8-électricité-32.png',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -28]
});
const iconDechets = L.icon({
    iconUrl: iconBasePath + 'icons8-corbeille-48.png',
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -40]
});

// Fonction utilitaire pour choisir l'icône selon le type (valeurs du <select>)
function getIconForType(typeValue) {
    switch ((typeValue || '').toLowerCase()) {
        case 'voirie':
            return iconVoirie;
        case 'eau':
            return iconEau;
        case 'electricite':
        case 'électricité':
            return iconElectricite;
        case 'insecurite':
            return iconSecurite;
        case 'dechet':
        case 'déchet':
            return iconDechets;
        default:
            return null;
    }
}

// Helper: redimensionne une image File en DataURL (maxWidth/maxHeight)
function resizeImage(file, maxWidth = 800, maxHeight = 800, quality = 0.8) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();
        reader.onload = function (e) {
            img.onload = function () {
                let { width, height } = img;
                const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                try {
                    const dataUrl = canvas.toDataURL('image/jpeg', quality);
                    resolve(dataUrl);
                } catch (err) {
                    // fallback to original
                    resolve(e.target.result);
                }
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Soumission du formulaire
const form = document.getElementById('form-signalement');
if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const titre = document.getElementById('titre-probleme')
            ? document.getElementById('titre-probleme').value.trim()
            : '';
        const type = document.getElementById('type-probleme')
            ? document.getElementById('type-probleme').value
            : '';
        const desc = document.getElementById('description')
            ? document.getElementById('description').value.trim()
            : '';
        const photoInput = document.getElementById('photo');

        if (!lastLatLng) {
            showMessage('Clique sur la carte pour indiquer le lieu.', 'error');
            return;
        }

        const lat = lastLatLng.lat;
        const lng = lastLatLng.lng;

        const chosenIcon = getIconForType(type);

        function finishWith(photoData) {
            const timestamp = new Date().toISOString();
            const signalement = {
                titre,
                type,
                description: desc,
                lat,
                lng,
                photo: photoData,
                timestamp
            };
            signalements.push(signalement);
            saveSignalements();
            addMarkerToMap(lat, lng, titre, desc, photoData, chosenIcon, timestamp);

            updateTotalSignalements();

            if (clickMarker) {
                map.removeLayer(clickMarker);
                clickMarker = null;
            }
            lastLatLng = null;
            form.reset();
            showMessage('Signalement envoyé ✅', 'success');
        }

        if (photoInput && photoInput.files && photoInput.files[0]) {
            const file = photoInput.files[0];
            showLoading('Traitement de l\'image...');
            // resize to limit file size and dimensions
            resizeImage(file, 800, 800, 0.78).then(dataUrl => {
                hideLoading();
                finishWith(dataUrl);
            }).catch(() => {
                // fallback to original file if resize fails
                const reader = new FileReader();
                reader.onload = (event) => {
                    hideLoading();
                    finishWith(event.target.result);
                };
                reader.onerror = () => { hideLoading(); finishWith(null); };
                reader.readAsDataURL(file);
            });
        } else {
            finishWith(null);
        }
    });
}

// Fonction pour ajouter un marqueur à la carte avec popup
function addMarkerToMap(lat, lng, titre, desc, photo, icon, timestamp) {
    const m = icon
        ? L.marker([lat, lng], { icon: icon }).addTo(map)
        : L.marker([lat, lng]).addTo(map);

    let popupContent = '<div class="popup-signalement">';
    popupContent += '<b>' + (titre || 'Signalement') + '</b><br>';

    if (photo) {
        popupContent += '<img src="' + photo + '" alt="' + titre + '" class="popup-photo"><br>';
    }

    popupContent += '<div class="popup-desc">' + (desc || '') + '</div>';

    if (timestamp) {
        try {
            const dt = new Date(timestamp).toLocaleString('fr-FR');
            popupContent += '<div class="popup-time">' + dt + '</div>';
        } catch (e) { /* ignore */ }
    }

    // bouton supprimer (data-ts = timestamp unique)
    if (timestamp) {
        popupContent += '<div style="margin-top:8px;"><button class="btn btn-delete-sig" data-ts="' + timestamp + '">Supprimer</button></div>';
    }

    popupContent += '</div>';

    m.bindPopup(popupContent).openPopup();
    // lier le timestamp au marker pour suppression
    try { m._sigTimestamp = timestamp; } catch (e) {}
    markers.push(m);
}

// Fonction pour sauvegarder les signalements
function saveSignalements() {
    try {
        localStorage.setItem('signalements', JSON.stringify(signalements));
    } catch (err) {
        console.warn('Impossible de sauvegarder les signalements', err);
    }
}

// Met à jour le compteur affiché
function updateTotalSignalements() {
    const el = document.getElementById('totalSignalements');
    if (el) el.textContent = String(signalements.length || 0);
}

// Supprimer un signalement par timestamp
function deleteSignalement(timestamp) {
    const idx = signalements.findIndex(s => s.timestamp === timestamp);
    if (idx === -1) return showMessage('Signalement introuvable.', 'error');
    // remove from array
    signalements.splice(idx, 1);
    saveSignalements();

    // remove marker(s) with same timestamp
    for (let i = markers.length - 1; i >= 0; i--) {
        const m = markers[i];
        if (m && m._sigTimestamp === timestamp) {
            try { map.removeLayer(m); } catch (e) {}
            markers.splice(i, 1);
        }
    }

    updateTotalSignalements();
    showMessage('Signalement supprimé.', 'success');
}

// Affiche un message temporaire (toast). type: 'success' | 'error' | undefined
function showMessage(text, type) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    if (type) toast.classList.add(`toast--${type}`);
    toast.textContent = text;
    document.body.appendChild(toast);

    // small delay to allow transition
    requestAnimationFrame(() => toast.classList.add('show'));

    // remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Loading toast helper
let __loadingToast = null;
function showLoading(text = 'Chargement...') {
    hideLoading();
    const toast = document.createElement('div');
    toast.className = 'toast toast--loading';
    toast.innerHTML = '<span class="toast-spinner"></span> ' + (text || 'Chargement...');
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    __loadingToast = toast;
}
function hideLoading() {
    if (!__loadingToast) return;
    __loadingToast.classList.remove('show');
    setTimeout(() => {
        if (__loadingToast && __loadingToast.parentNode) __loadingToast.parentNode.removeChild(__loadingToast);
        __loadingToast = null;
    }, 220);
}

// Charger les signalements au démarrage
function loadSignalements() {
    signalements.forEach(sig => {
        const icon = getIconForType(sig.type);
        addMarkerToMap(sig.lat, sig.lng, sig.titre, sig.description, sig.photo, icon, sig.timestamp);
    });
    updateTotalSignalements();
}

// Reverse geocode: lat,lng -> address (Nominatim)
function reverseGeocode(lat, lon) {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon);
    return fetch(url, { headers: { 'Accept-Language': 'fr' } })
        .then(r => {
            if (!r.ok) throw new Error('Network');
            return r.json();
        })
        .then(data => data.display_name || null);
}

// Geocode address -> lat,lng (Nominatim search), returns {lat,lng,display_name} or null
function geocodeAddress(query) {
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=' + encodeURIComponent(query) + '&limit=1&addressdetails=1';
    return fetch(url, { headers: { 'Accept-Language': 'fr' } })
        .then(r => {
            if (!r.ok) throw new Error('Network');
            return r.json();
        })
        .then(results => {
            if (!results || results.length === 0) return null;
            const res = results[0];
            return { lat: parseFloat(res.lat), lng: parseFloat(res.lon), display_name: res.display_name };
        });
}

// Si l'utilisateur tape une adresse dans #lieu et appuie sur Entrée, on géocode
const lieuInput = document.getElementById('lieu');
if (lieuInput) {
    // rendre le gestionnaire async pour utiliser await
    lieuInput.addEventListener('keydown', async function (ev) {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            const qRaw = lieuInput.value && lieuInput.value.trim();
            if (!qRaw) return;

            // si l'utilisateur a entré des coordonnées lat,lng on les utilise directement
            const latLngMatch = qRaw.match(/^\s*([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)\s*$/);
            if (latLngMatch) {
                const lat = parseFloat(latLngMatch[1]);
                const lng = parseFloat(latLngMatch[2]);
                lastLatLng = { lat: lat, lng: lng };
                if (clickMarker) clickMarker.setLatLng([lat, lng]); else clickMarker = L.marker([lat, lng]).addTo(map);
                map.setView([lat, lng], 16);
                return;
            }

            const tryFuzzySearch = async (query) => {
                // essai direct
                let res = null;
                try {
                    res = await geocodeAddress(query);
                } catch (e) {
                    // réseau ou erreur
                    return { error: true };
                }
                if (res) return res;

                // si échec, on tente en raccourcissant la requête (supprimer les derniers mots)
                const parts = query.split(/[ ,]+/).filter(Boolean);
                for (let len = parts.length - 1; len >= 1; len--) {
                    const q2 = parts.slice(0, len).join(' ');
                    try {
                        res = await geocodeAddress(q2);
                    } catch (e) {
                        return { error: true };
                    }
                    if (res) return res;
                }

                // essai final: ajouter le nom de la grande ville locale (Kinshasa)
                try {
                    res = await geocodeAddress(query + ' Kinshasa');
                } catch (e) {
                    return { error: true };
                }
                if (res) return res;

                return null;
            };

            showLoading('Recherche d\'adresse...');
            const resOrErr = await tryFuzzySearch(qRaw);
            hideLoading();
            if (resOrErr && resOrErr.error) {
                showMessage('Erreur réseau lors du géocodage.', 'error');
                return;
            }
            if (!resOrErr) {
                showMessage('Adresse introuvable. Essaie d\'être un peu plus précis.', 'error');
                return;
            }

            // on a une réponse
            lastLatLng = { lat: resOrErr.lat, lng: resOrErr.lng };
            if (clickMarker) {
                clickMarker.setLatLng([resOrErr.lat, resOrErr.lng]);
            } else {
                clickMarker = L.marker([resOrErr.lat, resOrErr.lng]).addTo(map);
            }
            map.setView([resOrErr.lat, resOrErr.lng], 16);
            // écrire une version lisible dans l'input si disponible
            if (resOrErr.display_name) lieuInput.value = resOrErr.display_name;
        }
    });
}

