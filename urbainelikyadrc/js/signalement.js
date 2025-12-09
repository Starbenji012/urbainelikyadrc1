
const sr = ScrollReveal({
    reset: true,
    distance: '80px',
    duration: 2000,
    delay: 200,
});

sr.reveal('header,.navbar,.titre,.guide-rapide,.signalement-wrap,.remerciement',{origin: 'top' });
sr.reveal('.footer-contenaire,.footer-bottom',{origin: 'bottom' });


// Initialise la carte (centrée sur Kinshasa)
const map = L.map('map').setView([-4.0383, 21.7587], 13);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Liste de marqueurs ajoutés
const markers = [];

// Dernière position cliquée sur la carte
let lastLatLng = null;
let clickMarker = null; // marker temporaire pour indiquer la sélection

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
const iconBasePath = '../img/icon-map/';
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

// Soumission du formulaire
const form = document.getElementById('form-signalement');
if (form) {
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const type = document.getElementById('type-probleme')
            ? document.getElementById('type-probleme').value
            : '';
        const desc = document.getElementById('description')
            ? document.getElementById('description').value
            : '';

        if (!lastLatLng) {
            alert('Veuillez cliquer sur la carte pour sélectionner le lieu du problème.');
            return;
        }

        const lat = lastLatLng.lat;
        const lng = lastLatLng.lng;

        const chosenIcon = getIconForType(type);

        const m = chosenIcon
            ? L.marker([lat, lng], { icon: chosenIcon }).addTo(map)
            : L.marker([lat, lng]).addTo(map);

        m.bindPopup('<b>' + (type || 'Signalement') + '</b><br>' + desc).openPopup();
        markers.push(m);

        // réinitialiser état local (si tu veux garder le marker temporaire, supprime ces lignes)
        if (clickMarker) {
            map.removeLayer(clickMarker);
            clickMarker = null;
        }
        lastLatLng = null;
        form.reset();

        alert('Signalement envoyé !');
    });
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
    lieuInput.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
            ev.preventDefault();
            const q = lieuInput.value && lieuInput.value.trim();
            if (!q) return;
            // If the user typed lat,lng we accept that immediately
            const latLngMatch = q.match(/^\s*([+-]?\d+(?:\.\d+)?)[,\s]+([+-]?\d+(?:\.\d+)?)\s*$/);
            if (latLngMatch) {
                const lat = parseFloat(latLngMatch[1]);
                const lng = parseFloat(latLngMatch[2]);
                lastLatLng = { lat: lat, lng: lng };
                if (clickMarker) clickMarker.setLatLng([lat, lng]); else clickMarker = L.marker([lat, lng]).addTo(map);
                map.setView([lat, lng], 16);
                return;
            }

            // Otherwise call Nominatim
            geocodeAddress(q).then(res => {
                if (!res) {
                    alert('Adresse introuvable. Essaie d\'être plus précis.');
                    return;
                }
                // place marker and update input with the display name
                lastLatLng = { lat: res.lat, lng: res.lng };
                if (clickMarker) {
                    clickMarker.setLatLng([res.lat, res.lng]);
                } else {
                    clickMarker = L.marker([res.lat, res.lng]).addTo(map);
                }
                map.setView([res.lat, res.lng], 16);
                lieuInput.value = res.display_name;
            }).catch(() => {
                alert('Erreur réseau lors du géocodage.');
            });
        }
    });
}

