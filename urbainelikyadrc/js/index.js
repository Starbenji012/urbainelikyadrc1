/* INDEX.JS - PAGE D'ACCUEIL */

/* GESTION MENU BURGER */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");
  if (menuBurger && navigationMenu) {
    const burgerIcon = menuBurger.querySelector("i");
    const updateBurgerIcon = () => {
      if (!burgerIcon) return;
      const isOpen = navigationMenu.classList.contains("mobile-active");
      burgerIcon.classList.toggle("bx-menu", !isOpen);
      burgerIcon.classList.toggle("bx-x", isOpen);
    };

    menuBurger.addEventListener("click", (e) => {
      e.stopPropagation();
      navigationMenu.classList.toggle("mobile-active");
      updateBurgerIcon();
    });
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigationMenu.classList.remove("mobile-active");
        updateBurgerIcon();
      });
    });

    document.addEventListener("click", (e) => {
      if (!navigationMenu.classList.contains("mobile-active")) return;

      const menuRect = navigationMenu.getBoundingClientRect();
      const clickedOverlayZone = e.clientX < menuRect.left;
      const clickedInsideMenu = navigationMenu.contains(e.target);
      const clickedBurger = menuBurger.contains(e.target);

      if (clickedOverlayZone || (!clickedInsideMenu && !clickedBurger)) {
        navigationMenu.classList.remove("mobile-active");
        updateBurgerIcon();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        navigationMenu.classList.remove("mobile-active");
        updateBurgerIcon();
      }
    });

    updateBurgerIcon();
  }
}

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

  const localIdees = readLocalArray("idees_page");
  const backendIdees = await fetchArray("/backend/api/idees.php");
  const allIdees = mergeUniqueByKey(backendIdees, localIdees, (i) =>
    String(i?.id || i?.timestamp || i?.titre || ""),
  );

  const sigEl = document.getElementById("sig-total");
  if (sigEl) sigEl.textContent = String(allSignalements.length);

  const ideesEl = document.getElementById("idees-soumis");
  if (ideesEl) ideesEl.textContent = String(allIdees.length);
}

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();
  updateGlobalStats();
});
