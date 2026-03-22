/* INDEX.JS - PAGE D'ACCUEIL */

function readLocalArray(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) {
    return [];
  }
}

async function fetchArray(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) {
    return [];
  }
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
  // 1) Lire les signalements (local + backend), puis fusionner sans doublons.
  const localSignalements = readLocalArray("signalements");
  const backendSignalements = await fetchArray("/backend/api/signaler.php");
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
  const backendIdees = await fetchArray("/backend/api/idees.php");
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
