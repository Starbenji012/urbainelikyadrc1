/* UTILS.JS - Fonctions partagées */

const AUTH_LOGOUT_ENDPOINTS = [
  "/backend/api/auth/logout.php",
  "../backend/api/auth/logout.php",
  "backend/api/auth/logout.php",
];

const AUTH_NAV_TEXT = {
  defaultUser: "Utilisateur",
  login: "Connexion",
  connected: "Connecté",
  identityPrefix: "Identité: ",
  emailPrefix: "Email: ",
  emailMissing: "Email: non renseigné",
  logout: "Déconnexion",
};

/* Navigation simple */
function goBack() {
  window.location.href = "./index.html";
}

/* Menu burger et état d'authentification */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");
  if (menuBurger && navigationMenu) {
    const burgerIcon = menuBurger.querySelector("i");
    // Garde l'icône synchronisée avec l'état du menu (ouvert/fermé).
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

    // Ferme le menu après un clic sur un lien.
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener(
        "click",
        () => (
          navigationMenu.classList.remove("mobile-active"),
          updateBurgerIcon()
        ),
      );
    });

    // Clic à gauche du panneau (overlay) ou en dehors => fermeture.
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

    // Touche Echap => fermeture rapide du menu.
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        navigationMenu.classList.remove("mobile-active");
        updateBurgerIcon();
      }
    });

    updateBurgerIcon();
  }

  // Met à jour le bouton "Connexion" selon l'état de session local.
  initAuthNav();
}

function readAuthState() {
  const nom = String(localStorage.getItem("user_nom") || "").trim();
  const email = String(localStorage.getItem("user_email") || "").trim();
  const connected =
    String(localStorage.getItem("auth_connected") || "") === "1" ||
    Boolean(nom);

  return {
    connected,
    nom: nom || AUTH_NAV_TEXT.defaultUser,
    email,
  };
}

function clearAuthState() {
  // Nettoyage complet des informations de connexion locale.
  localStorage.removeItem("auth_connected");
  localStorage.removeItem("user_nom");
  localStorage.removeItem("user_email");
}

async function logoutFromBackendIfPossible() {
  for (const endpoint of AUTH_LOGOUT_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
      });
      if (resp.ok) return true;
    } catch (e) {
      // On ignore l'erreur réseau et on continue la déconnexion locale.
    }
  }

  return false;
}

function createAuthDropdown(profile, onLogout) {
  const panel = document.createElement("div");
  panel.className = "auth-dropdown-panel";
  panel.style.position = "absolute";
  panel.style.top = "calc(100% + 8px)";
  panel.style.right = "0";
  panel.style.minWidth = "220px";
  panel.style.padding = "12px";
  panel.style.borderRadius = "10px";
  panel.style.background = "#ffffff";
  panel.style.boxShadow = "0 10px 24px rgba(0,0,0,0.15)";
  panel.style.border = "1px solid rgba(0,0,0,0.08)";
  panel.style.zIndex = "9999";
  panel.style.display = "none";

  const identity = document.createElement("p");
  identity.style.margin = "0 0 8px 0";
  identity.style.fontWeight = "600";
  identity.textContent = `${AUTH_NAV_TEXT.identityPrefix}${profile.nom}`;

  const email = document.createElement("p");
  email.style.margin = "0 0 10px 0";
  email.style.fontSize = "0.9rem";
  email.style.opacity = "0.8";
  email.textContent = profile.email
    ? `${AUTH_NAV_TEXT.emailPrefix}${profile.email}`
    : AUTH_NAV_TEXT.emailMissing;

  const logoutBtn = document.createElement("button");
  logoutBtn.type = "button";
  logoutBtn.textContent = AUTH_NAV_TEXT.logout;
  logoutBtn.style.width = "100%";
  logoutBtn.style.padding = "8px 10px";
  logoutBtn.style.borderRadius = "8px";
  logoutBtn.style.border = "none";
  logoutBtn.style.cursor = "pointer";
  logoutBtn.style.background = "#c1272d";
  logoutBtn.style.color = "#fff";
  logoutBtn.addEventListener("click", onLogout);

  panel.appendChild(identity);
  panel.appendChild(email);
  panel.appendChild(logoutBtn);
  return panel;
}

function initAuthNav() {
  const loginLink = document.querySelector(".navigation-menu .btn-connexion");
  if (!loginLink) return;

  // Évite d'ajouter plusieurs fois les mêmes listeners.
  if (loginLink.dataset.authNavReady === "1") {
    const state = readAuthState();
    if (!state.connected) {
      loginLink.textContent = AUTH_NAV_TEXT.login;
      loginLink.setAttribute("href", "connexion.html");
    }
    return;
  }

  loginLink.dataset.authNavReady = "1";

  const linkItem = loginLink.closest("li") || loginLink.parentElement;
  if (linkItem) {
    linkItem.style.position = "relative";
  }

  let dropdown = null;

  const refreshAuthNav = () => {
    const state = readAuthState();

    if (!state.connected) {
      loginLink.textContent = AUTH_NAV_TEXT.login;
      loginLink.setAttribute("href", "connexion.html");
      if (dropdown) {
        dropdown.style.display = "none";
      }
      return;
    }

    loginLink.textContent = AUTH_NAV_TEXT.connected;
    loginLink.setAttribute("href", "#");

    if (!dropdown && linkItem) {
      dropdown = createAuthDropdown(state, async () => {
        await logoutFromBackendIfPossible();
        clearAuthState();
        refreshAuthNav();
      });
      linkItem.appendChild(dropdown);
    }

    if (dropdown) {
      const paragraphs = dropdown.querySelectorAll("p");
      if (paragraphs[0]) {
        paragraphs[0].textContent = `${AUTH_NAV_TEXT.identityPrefix}${state.nom}`;
      }
      if (paragraphs[1]) {
        paragraphs[1].textContent = state.email
          ? `${AUTH_NAV_TEXT.emailPrefix}${state.email}`
          : AUTH_NAV_TEXT.emailMissing;
      }
    }
  };

  loginLink.addEventListener("click", (e) => {
    const state = readAuthState();
    if (!state.connected) return;

    e.preventDefault();
    if (!dropdown) return;

    dropdown.style.display =
      dropdown.style.display === "none" ? "block" : "none";
  });

  document.addEventListener("click", (e) => {
    if (!dropdown || dropdown.style.display === "none") return;
    const insideLink = loginLink.contains(e.target);
    const insideDropdown = dropdown.contains(e.target);
    if (!insideLink && !insideDropdown) {
      dropdown.style.display = "none";
    }
  });

  refreshAuthNav();
}
