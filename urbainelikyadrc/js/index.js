/* INDEX.JS - Page d'accueil */

const SIGNALEMENTS_ENDPOINTS = [
  "/backend/api/signalements/index.php",
  "../backend/api/signalements/index.php",
  "backend/api/signalements/index.php",
];

const IDEES_ENDPOINTS = [
  "/backend/api/idees/index.php",
  "../backend/api/idees/index.php",
  "backend/api/idees/index.php",
];

const STATS_ENDPOINTS = [
  "/backend/api/stats/dashboard.php",
  "../backend/api/stats/dashboard.php",
  "backend/api/stats/dashboard.php",
];

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
      if (Array.isArray(j)) return j;
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

      const signalements = Number(data.signalements_total);
      const idees = Number(data.idees_total);
      if (Number.isFinite(signalements) && Number.isFinite(idees)) {
        return {
          signalements: Math.max(0, Math.trunc(signalements)),
          idees: Math.max(0, Math.trunc(idees)),
        };
      }
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

async function updateGlobalStats() {
  // Priorite aux statistiques backend, plus fiables en production multi-utilisateurs.
  const dashboardStats = await fetchDashboardStats(STATS_ENDPOINTS);
  if (dashboardStats) {
    const sigEl = document.getElementById("sig-total");
    if (sigEl) sigEl.textContent = String(dashboardStats.signalements);

    const ideesEl = document.getElementById("idees-soumis");
    if (ideesEl) ideesEl.textContent = String(dashboardStats.idees);

    return;
  }

  // Fallback local+backend liste si l'endpoint global n'est pas disponible.
  // 1) Lire les signalements (local + backend), puis fusionner sans doublons.
  const localSignalements = readLocalArray("signalements");
  const backendSignalements = await fetchArray(SIGNALEMENTS_ENDPOINTS);
  const allSignalements = mergeUniqueByKey(
    backendSignalements,
    localSignalements,
    (s) =>
      String(
        s?.id ||
          s?.timestamp ||
          `${s?.titre || ""}-${s?.lat || ""}-${s?.lng || ""}`,
      ),
  );

  // 2) Lire les idées (local + backend), puis fusionner sans doublons.
  const localIdees = readLocalArray("idees_page");
  const backendIdees = await fetchArray(IDEES_ENDPOINTS);
  const allIdees = mergeUniqueByKey(backendIdees, localIdees, (i) =>
    String(i?.id || i?.timestamp || i?.titre || ""),
  );

  // 3) Afficher les compteurs dans la page d'accueil.
  const sigEl = document.getElementById("sig-total");
  if (sigEl) sigEl.textContent = String(allSignalements.length);

  const ideesEl = document.getElementById("idees-soumis");
  if (ideesEl) ideesEl.textContent = String(allIdees.length);
}

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  updateGlobalStats();
});
