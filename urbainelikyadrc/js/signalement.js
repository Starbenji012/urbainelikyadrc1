
const sr = ScrollReveal({
    reset: true,
    distance: '80px',
    duration: 2000,
    delay: 200,
});

sr.reveal('header,.navbar,.titre,.guide-rapide,.signalement-wrap,.titre-signalement-non-afficher-map,.Signalements-header,.Signalements-grid,.remerciement', { origin: 'top' });
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
// Dernier résultat de géocodage (peut contenir country_code)
let lastGeocodeResult = null;

// Quand l'utilisateur clique sur la carte, on mémorise la position
map.on('click', async function (e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;
    const lieuInput = document.getElementById('lieu');
    
    // Vérifier que le clic est en RDC avant de mémoriser
    try {
        const rev = await reverseGeocodeDetails(lat, lng);
        if (rev && rev.address && rev.address.country_code) {
            const isRDC = String(rev.address.country_code).toLowerCase() === 'cd';
            if (!isRDC) {
                showMessage('Clic détecté hors de la RDC — opération annulée.', 'error');
                showLieuWarning('Clic en dehors de la RDC. Clique sur le territoire de la RDC.');
                return;
            }
        }
    } catch (err) {
        // Si on ne peut pas vérifier, on laisse passer pour éviter les faux positifs
    }
    
    lastLatLng = e.latlng;
    if (lieuInput) {
        // show lat,lng immediately while reverse geocoding runs
        lieuInput.value = lat.toFixed(6) + ', ' + lng.toFixed(6);
        clearLieuWarning();
        // try to get a human readable address and set it in the input
        reverseGeocode(lat, lng).then(addr => {
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
    form.addEventListener('submit', async function (e) {
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
        const lieuValue = lieuInput ? lieuInput.value.trim() : '';

        // Si pas de localisation cliquée mais adresse écrite, essayer de la géocoder
        if (!lastLatLng) {
            if (!lieuValue) {
                showMessage('Clique sur la carte ou écris une adresse.', 'error');
                return;
            }
            // Essayer géocoder l'adresse écrite
            showLoading('Vérification de l\'adresse...');
            const latLngMatch = lieuValue.match(/^\s*([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)\s*$/);
            if (latLngMatch) {
                // C'est des coordonnées
                const lat = parseFloat(latLngMatch[1]);
                const lng = parseFloat(latLngMatch[2]);
                lastLatLng = { lat: lat, lng: lng };
                    clearLieuWarning();
                    hideLoading();
            
                    // si l'utilisateur a fourni des coordonnées, tenter un reverse-geocode pour vérifier le pays
                    try {
                        const rev = await reverseGeocodeDetails(lat, lng);
                        if (rev && rev.address && rev.address.country_code && String(rev.address.country_code).toLowerCase() !== 'cd') {
                            showMessage('Coordonnées situées hors de la RDC — envoi bloqué.', 'error');
                            showLieuWarning('Coordonnées hors de la RDC. Saisis une adresse en RDC ou clique sur la carte.');
                            lastLatLng = null;
                            return;
                        }
                    } catch (e) { /* ignore */ }
            
            } else {
                // C'est une adresse à rechercher
                const tryFuzzySearch = async (query) => {
                    let res = null;
                    try {
                        res = await geocodeAddress(query);
                    } catch (e) {
                        return { error: true };
                    }
                    if (res) return res;
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
                    try {
                        res = await geocodeAddress(query + ' Kinshasa');
                    } catch (e) {
                        return { error: true };
                    }
                    if (res) return res;
                    return null;
                };
                const resOrErr = await tryFuzzySearch(lieuValue);
                hideLoading();
                if (resOrErr && resOrErr.error) {
                    showMessage('Erreur réseau lors de la vérification.', 'error');
                    showLieuWarning('Erreur réseau lors de la vérification de l\'adresse.');
                    return;
                }
                if (!resOrErr) {
                    // Adresse introuvable → on accepte mais on avertit l'utilisateur
                    showLieuWarning('⚠️ Adresse introuvable dans la base de données. Vérification en RDC...');
                    // On laisse passer avec un avertissement
                    // mais on ne peut pas vérifier le pays; bloquer par sécurité
                    showMessage('Adresse introuvable et impossible à vérifier — bloqée par sécurité. Clique sur la carte en RDC.', 'error');
                    return;
                }
                // Bloquer si adresse hors RDC
                if (resOrErr.country_code && String(resOrErr.country_code).toLowerCase() !== 'cd') {
                    showMessage('Adresse trouvée hors de la RDC — envoi bloqué.', 'error');
                    showLieuWarning('Adresse trouvée hors de la RDC. Saisis une adresse en RDC ou clique sur la carte.');
                    return;
                }
                // Adresse trouvée et en RDC ✓
                lastGeocodeResult = resOrErr;
                lastLatLng = { lat: resOrErr.lat, lng: resOrErr.lng };
                if (clickMarker) {
                    clickMarker.setLatLng([resOrErr.lat, resOrErr.lng]);
                } else {
                    clickMarker = L.marker([resOrErr.lat, resOrErr.lng]).addTo(map);
                }
                map.flyTo([resOrErr.lat, resOrErr.lng], 16, { duration: 1.2 });
                if (resOrErr.display_name) lieuInput.value = resOrErr.display_name;
                // avertir si résultat hors de la zone affichée
                try {
                    const foundLL = L.latLng(resOrErr.lat, resOrErr.lng);
                    if (!map.getBounds().contains(foundLL)) {
                        showLieuWarning('Adresse trouvée mais en dehors de la zone affichée sur la carte.');
                    } else {
                        clearLieuWarning();
                    }
                } catch (e) { /* ignore */ }
            }
        }

        const lat = lastLatLng.lat;
        const lng = lastLatLng.lng;

        // Vérifier que l'adresse/coordonnées sont bien en RDC; si on a un résultat de géocodage récent on l'utilise
        try {
            let countryOk = true;
            if (lastGeocodeResult && lastGeocodeResult.country_code) {
                countryOk = String(lastGeocodeResult.country_code).toLowerCase() === 'cd';
            } else {
                // tenter un reverse-geocode pour connaître le pays
                const rev = await reverseGeocodeDetails(lat, lng);
                if (rev && rev.address && rev.address.country_code) {
                    countryOk = String(rev.address.country_code).toLowerCase() === 'cd';
                } else {
                    // si on ne sait pas, on laisse passer (éviter faux positifs)
                    countryOk = true;
                }
            }
            if (!countryOk) {
                showMessage('Adresse localisée hors de la RDC — envoi bloqué.', 'error');
                showLieuWarning('Adresse localisée hors de la RDC. Saisis une adresse en RDC ou clique sur la carte.');
                hideLoading();
                return;
            }
        } catch (e) { /* ignore */ }

        // Si le point se trouve hors de la vue actuelle, recentrer la carte
        try {
            const pt = L.latLng(lat, lng);
            if (!map.getBounds().contains(pt)) {
                // recentre et zoome sur l'adresse pour que l'utilisateur la voie
                map.flyTo([lat, lng], 16, { duration: 1.2 });
                showMessage('La carte a été recentrée sur l\'adresse trouvée.', 'success');
                clearLieuWarning();
            } else {
                clearLieuWarning();
            }
        } catch (e) { /* ignore */ }

        const chosenIcon = getIconForType(type);

        function finishWith(photoData) {
            const timestamp = new Date().toISOString();
            const signalement = {
                titre,
                type,
                description: desc,
                lat,
                lng,
                lieu: lieuValue,
                photo: photoData,
                timestamp
            };
            signalements.push(signalement);
            saveSignalements();
            addMarkerToMap(lat, lng, titre, desc, photoData, chosenIcon, timestamp);

            updateTotalSignalements();
            renderSignalements();

            if (clickMarker) {
                map.removeLayer(clickMarker);
                clickMarker = null;
            }
            lastLatLng = null;
            lastGeocodeResult = null;
            form.reset();
            clearLieuWarning();
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
    renderSignalements();
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

// Afficher un avertissement lié à l'input #lieu (non bloquant)
function showLieuWarning(text) {
    const input = document.getElementById('lieu');
    if (!input) return;
    let el = document.getElementById('lieu-warning');
    if (!el) {
        el = document.createElement('div');
        el.id = 'lieu-warning';
        el.className = 'lieu-warning';
        // style minimal pour être visible sans dépendre du CSS
        el.style.color = '#b22222';
        el.style.fontSize = '0.9em';
        el.style.marginTop = '6px';
        el.style.maxWidth = '420px';
        input.parentNode && input.parentNode.insertBefore(el, input.nextSibling);
    }
    el.textContent = text || '';
}

function clearLieuWarning() {
    const el = document.getElementById('lieu-warning');
    if (el && el.parentNode) el.parentNode.removeChild(el);
}

// Charger les signalements au démarrage
function loadSignalements() {
    signalements.forEach(sig => {
        const icon = getIconForType(sig.type);
        addMarkerToMap(sig.lat, sig.lng, sig.titre, sig.description, sig.photo, icon, sig.timestamp);
    });
    updateTotalSignalements();
    renderSignalements();
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
    // Normaliser la requête: convertir en minuscules et nettoyer les espaces multiples
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=' + encodeURIComponent(normalizedQuery) + '&limit=3&addressdetails=1';
    return fetch(url, { headers: { 'Accept-Language': 'fr' } })
        .then(r => {
            if (!r.ok) throw new Error('Network');
            return r.json();
        })
        .then(results => {
            if (!results || results.length === 0) return null;
            const res = results[0];
            return {
                lat: parseFloat(res.lat),
                lng: parseFloat(res.lon),
                display_name: res.display_name,
                address: res.address || null,
                country: res.address && res.address.country || null,
                country_code: res.address && res.address.country_code || null
            };
        });
}

// Reverse geocode with address details -> returns full JSON result or null
function reverseGeocodeDetails(lat, lon) {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&addressdetails=1';
    return fetch(url, { headers: { 'Accept-Language': 'fr' } })
        .then(r => { if (!r.ok) throw new Error('Network'); return r.json(); })
        .then(data => data || null)
        .catch(() => null);
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
                // vérifier que les coordonnées sont en RDC
                try {
                    const rev = await reverseGeocodeDetails(lat, lng);
                    if (rev && rev.address && rev.address.country_code && String(rev.address.country_code).toLowerCase() !== 'cd') {
                        showMessage('Coordonnées situées hors de la RDC — opération annulée.', 'error');
                        showLieuWarning('Coordonnées hors de la RDC. Saisis une adresse en RDC ou clique sur la carte.');
                        return;
                    }
                } catch (e) { /* ignore */ }
                lastLatLng = { lat: lat, lng: lng };
                if (clickMarker) clickMarker.setLatLng([lat, lng]); else clickMarker = L.marker([lat, lng]).addTo(map);
                clearLieuWarning();
                map.flyTo([lat, lng], 16, { duration: 1.2 });
                return;
            }

            const tryFuzzySearch = async (query) => {
                // essai direct (même partiel, même incomplet)
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
                showLieuWarning('Erreur réseau lors du géocodage.');
                return;
            }
            if (!resOrErr) {
                // Adresse introuvable → on avertit mais on accepte si c'est en RDC
                showMessage('⚠️ Adresse introuvable dans la base. Impossible à vérifier — clique sur la carte en RDC.', 'error');
                showLieuWarning('⚠️ Adresse introuvable. Clique sur la carte en RDC pour valider la position.');
                return;
            }
            // on a une réponse
            // bloquer si l'adresse n'est pas dans la RDC (country_code fourni par Nominatim)
            if (resOrErr.country_code && String(resOrErr.country_code).toLowerCase() !== 'cd') {
                showMessage('Adresse trouvée hors de la RDC — envoi bloqué.', 'error');
                showLieuWarning('Adresse trouvée hors de la RDC. Saisis une adresse en RDC ou clique sur la carte.');
                return;
            }
            // mémoriser le résultat de géocodage
            lastGeocodeResult = resOrErr;
            lastLatLng = { lat: resOrErr.lat, lng: resOrErr.lng };
            if (clickMarker) {
                clickMarker.setLatLng([resOrErr.lat, resOrErr.lng]);
            } else {
                clickMarker = L.marker([resOrErr.lat, resOrErr.lng]).addTo(map);
            }
            map.flyTo([resOrErr.lat, resOrErr.lng], 16, { duration: 1.2 });
            // écrire une version lisible dans l'input si disponible
            if (resOrErr.display_name) lieuInput.value = resOrErr.display_name;
            // avertir si résultat hors de la zone affichée
            try {
                const foundLL = L.latLng(resOrErr.lat, resOrErr.lng);
                if (!map.getBounds().contains(foundLL)) {
                    showLieuWarning('Adresse trouvée mais en dehors de la zone affichée sur la carte.');
                } else {
                    clearLieuWarning();
                }
            } catch (e) { /* ignore */ }
            showMessage('Adresse trouvée ! ✓', 'success');
        }
    });
}

// ========== RENDU DE LA GRILLE DE SIGNALEMENTS ==========
function renderSignalements() {
    const container = document.getElementById('listeSignalements');
    if (!container) return;

    container.innerHTML = '';
    const frag = document.createDocumentFragment();

    signalements.forEach((sig, index) => {
        const card = document.createElement('div');
        card.className = 'carte-signalement';

        // Ajouter la photo si elle existe
        if (sig.photo) {
            const img = document.createElement('img');
            img.src = sig.photo;
            img.alt = sig.titre;
            img.className = 'carte-signalement-photo';
            card.appendChild(img);
        }

        // Titre
        const h3 = document.createElement('h3');
        h3.textContent = sig.titre;
        card.appendChild(h3);

        // Description
        const desc = document.createElement('p');
        desc.className = 'carte-signalement-desc';
        desc.textContent = sig.description;
        card.appendChild(desc);

        // Type (catégorie)
        const type = document.createElement('span');
        type.className = 'carte-signalement-type';
        type.textContent = (sig.type || 'Sans catégorie').charAt(0).toUpperCase() + (sig.type || 'sans catégorie').slice(1);
        card.appendChild(type);

        // Location (adresse saisie)
        const location = document.createElement('p');
        location.className = 'carte-signalement-location';
        location.textContent = `📍 ${sig.lieu || 'Adresse non spécifiée'}`;
        card.appendChild(location);

        // Meta (date)
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

        // Boutons (Voir sur carte + Supprimer)
        const btnContainer = document.createElement('div');
        btnContainer.className = 'carte-signalement-buttons';

        const btnVoirCarte = document.createElement('button');
        btnVoirCarte.type = 'button';
        btnVoirCarte.className = 'btn-voir-carte';
        btnVoirCarte.textContent = 'Voir sur carte';
        btnVoirCarte.addEventListener('click', () => {
            map.flyTo([sig.lat, sig.lng], 16, { duration: 1.2 });
            // Scroll vers la carte si elle est visible
            const mapEl = document.getElementById('map');
            if (mapEl) {
                mapEl.scrollIntoView({ behavior: 'smooth' });
            }
        });

        const btnDelete = document.createElement('button');
        btnDelete.type = 'button';
        btnDelete.className = 'btn-delete-signalement';
        btnDelete.textContent = 'Supprimer';
        btnDelete.addEventListener('click', () => {
            if (!confirm('Supprimer ce signalement ?')) return;
            deleteSignalement(sig.timestamp);
        });

        btnContainer.appendChild(btnVoirCarte);
        btnContainer.appendChild(btnDelete);
        card.appendChild(btnContainer);

        frag.appendChild(card);
    });

    container.appendChild(frag);

    // Mettre à jour les compteurs
    updateTotalSignalements();
}

// Mise à jour des compteurs (affichés et total)
function updateTotalSignalements() {
    const totalEl = document.getElementById('totalSignalementsAffiche');
    const totalAllEl = document.getElementById('totalSignalementsAll');
    
    if (totalEl) {
        // Compter les signalements affichés sur la carte (au moins un marker)
        totalEl.textContent = markers.length;
    }
    
    if (totalAllEl) {
        totalAllEl.textContent = signalements.length;
    }
}

