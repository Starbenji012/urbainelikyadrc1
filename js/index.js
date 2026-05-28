/* INDEX.JS - Page d'accueil */

const SIGNALEMENTS_ENDPOINTS = buildApiEndpoints("signalements/index.php");

const IDEES_ENDPOINTS = buildApiEndpoints("idees/index.php");

const STATS_ENDPOINTS = buildApiEndpoints("stats/dashboard.php");

function readLocalArray(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

async function fetchArray(urls) {
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      const data = unwrapApiListResponse(j);
      if (data.length) return data;
    } catch (e) {
      // On essaie l'URL suivante.
    }
  }
  return [];
}

async function fetchDashboardStats(urls) {
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok) continue;
      const j = await r.json();
      const data = j?.data;
      if (!data || typeof data !== "object") continue;

      return {
        signalements: Math.max(
          0,
          Math.trunc(Number(data.signalements_total) || 0),
        ),
        signalementsEnCours: Math.max(
          0,
          Math.trunc(Number(data.signalements_en_cours) || 0),
        ),
        signalementsResolus: Math.max(
          0,
          Math.trunc(Number(data.signalements_resolus) || 0),
        ),
        idees: Math.max(0, Math.trunc(Number(data.idees_total) || 0)),
        ideesEnCours: Math.max(0, Math.trunc(Number(data.idees_en_cours) || 0)),
        ideesRealisees: Math.max(
          0,
          Math.trunc(Number(data.idees_realisees) || 0),
        ),
      };
    } catch (e) {
      // On essaie l'URL suivante.
    }
  }

  return null;
}

function mergeUniqueByKey(arrA, arrB, keyFn) {
  const out = [];
  const seen = new Set();
  [...arrA, ...arrB].forEach((item) => {
    const k = keyFn(item);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(item);
  });
  return out;
}

function normalizeStatus(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "_")
    .trim();
}

async function updateGlobalStats() {
  // Priorite aux statistiques backend, plus fiables en production multi-utilisateurs.
  const dashboardStats = await fetchDashboardStats(STATS_ENDPOINTS);
  if (dashboardStats) {
    const sigEl = document.getElementById("sig-total");
    if (sigEl) sigEl.textContent = String(dashboardStats.signalements);

    const sigEnCoursEl = document.getElementById("sig-en-cours");
    if (sigEnCoursEl)
      sigEnCoursEl.textContent = String(
        dashboardStats.signalementsEnCours || 0,
      );

    const sigTraiterEl = document.getElementById("sig-traiter");
    if (sigTraiterEl)
      sigTraiterEl.textContent = String(
        dashboardStats.signalementsResolus || 0,
      );

    const ideesEl = document.getElementById("idees-soumis");
    if (ideesEl) ideesEl.textContent = String(dashboardStats.idees);

    const ideesRealiseEl = document.getElementById("idees-realise");
    if (ideesRealiseEl)
      ideesRealiseEl.textContent = String(dashboardStats.ideesRealisees || 0);

    return;
  }

  // Afficher uniquement les compteurs backend/BDD.
  const sigEl = document.getElementById("sig-total");
  if (sigEl) sigEl.textContent = String(dashboardStats.signalements);

  const sigEnCoursEl = document.getElementById("sig-en-cours");
  if (sigEnCoursEl) {
    sigEnCoursEl.textContent = String(dashboardStats.signalementsEnCours || 0);
  }

  const sigTraiterEl = document.getElementById("sig-traiter");
  if (sigTraiterEl) {
    sigTraiterEl.textContent = String(dashboardStats.signalementsResolus || 0);
  }

  const ideesEl = document.getElementById("idees-soumis");
  if (ideesEl) ideesEl.textContent = String(dashboardStats.idees);

  const ideesRealiseEl = document.getElementById("idees-realise");
  if (ideesRealiseEl) {
    ideesRealiseEl.textContent = String(dashboardStats.ideesRealisees || 0);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  updateGlobalStats();
});
