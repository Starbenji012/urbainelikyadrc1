/* CONNEXION.JS - Connexion utilisateur (backend + fallback local) */

const AUTH_LOGIN_ENDPOINTS = buildApiEndpoints("auth/login.php");

const AUTH_RESET_DIRECT_ENDPOINTS = buildApiEndpoints(
  "auth/reset-password-direct.php",
);

const CONNEXION_TEXT = {
  invalidCredentials: "Identifiants invalides.",
  localLoginSuccess: "Connexion locale réussie (backend indisponible).",
  loginSuccess: "Connexion réussie !",
  requiredFields: "Veuillez remplir tous les champs",
  backendUnavailable: "Backend indisponible.",
  defaultUser: "Utilisateur local",
  forgotInvalidEmail: "Veuillez entrer une adresse email valide.",
  forgotInvalidPassword:
    "Le nouveau mot de passe doit contenir au moins 8 caracteres.",
  forgotPasswordMismatch:
    "Le nouveau mot de passe et sa confirmation ne correspondent pas.",
  forgotSuccess:
    "Mot de passe reinitialise avec succes. Connecte-toi maintenant.",
  forgotFailure: "Impossible de reinitialiser le mot de passe pour le moment.",
};

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagée dans utils.js.
  initMenuBurger();

  const formConnexion = document.getElementById("formCon");
  if (formConnexion) {
    formConnexion.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nom = document.getElementById("nom")?.value.trim();
      const prenom = document.getElementById("prenom")?.value.trim();
      const email = document.getElementById("email").value;
      const password = document.getElementById("password").value;
      if (email && password) {
        const result = await loginToBackend({ email, password });

        if (!result.ok) {
          // Si le backend est joignable mais refuse la connexion, on affiche son message.
          if (result.reachable) {
            alert(result.message || CONNEXION_TEXT.invalidCredentials);
            return;
          }

          // Fallback local uniquement si le backend est vraiment indisponible.
          const localOk = loginLocally({ email, password, nom, prenom });
          if (!localOk) {
            alert(CONNEXION_TEXT.invalidCredentials);
            return;
          }
          alert(CONNEXION_TEXT.localLoginSuccess);
        } else {
          // Mémoriser un nom d'affichage local pour les pages signalement/communauté.
          const backendUser = result.user || {};
          const displayName = [backendUser.prenom, backendUser.nom]
            .filter(Boolean)
            .join(" ")
            .trim();
          if (displayName) {
            localStorage.setItem("user_nom", displayName);
          }
          if (backendUser.email) {
            localStorage.setItem("user_email", backendUser.email);
          }
          localStorage.setItem("auth_connected", "1");
          alert(CONNEXION_TEXT.loginSuccess);
        }
        window.location.href = "index.html";
      } else {
        alert(CONNEXION_TEXT.requiredFields);
      }
    });
  }

  const forgotPasswordLink = document.getElementById("forgotPasswordLink");
  const resetPanel = document.getElementById("resetPanel");
  const resetCancelBtn = document.getElementById("resetCancelBtn");
  const resetSubmitBtn = document.getElementById("resetSubmitBtn");

  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener("click", async (e) => {
      e.preventDefault();

      if (!resetPanel) return;
      const loginEmail = document.getElementById("email");
      const resetEmail = document.getElementById("resetEmail");
      if (resetEmail && loginEmail && !String(resetEmail.value || "").trim()) {
        resetEmail.value = String(loginEmail.value || "").trim();
      }

      resetPanel.hidden = false;
    });
  }

  if (resetCancelBtn) {
    resetCancelBtn.addEventListener("click", () => {
      if (!resetPanel) return;
      resetPanel.hidden = true;
    });
  }

  if (resetSubmitBtn) {
    resetSubmitBtn.addEventListener("click", async () => {
      const resetEmail = String(
        document.getElementById("resetEmail")?.value || "",
      )
        .trim()
        .toLowerCase();
      const newPassword = String(
        document.getElementById("resetPassword")?.value || "",
      );
      const confirmPassword = String(
        document.getElementById("resetPasswordConfirm")?.value || "",
      );

      if (!isValidEmail(resetEmail)) {
        alert(CONNEXION_TEXT.forgotInvalidEmail);
        return;
      }

      if (newPassword.length < 8) {
        alert(CONNEXION_TEXT.forgotInvalidPassword);
        return;
      }

      if (newPassword !== confirmPassword) {
        alert(CONNEXION_TEXT.forgotPasswordMismatch);
        return;
      }

      const result = await sendDirectResetRequest(resetEmail, newPassword);
      if (!result.ok) {
        alert(result.message || CONNEXION_TEXT.forgotFailure);
        return;
      }

      alert(result.message || CONNEXION_TEXT.forgotSuccess);
      if (resetPanel) {
        resetPanel.hidden = true;
      }
    });
  }

  // Gestion d'un éventuel basculement de formulaire.
  document.querySelectorAll(".Switch").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".form")
        .forEach((f) => f.classList.toggle("active"));
    });
  });
});

async function loginToBackend(payload) {
  for (const endpoint of AUTH_LOGIN_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(() => ({}));

      if (resp.ok) {
        return {
          ok: true,
          reachable: true,
          user: json?.data || null,
          message: "",
        };
      }

      // 5xx = backend joignable mais erreur serveur (souvent DB indisponible).
      // On tente les autres endpoints puis on bascule sur le fallback local.
      if (resp.status >= 500) {
        continue;
      }

      return {
        ok: false,
        reachable: true,
        user: null,
        message: json?.message || CONNEXION_TEXT.invalidCredentials,
      };
    } catch (e) {}
  }
  return {
    ok: false,
    reachable: false,
    user: null,
    message: CONNEXION_TEXT.backendUnavailable,
  };
}

async function sendDirectResetRequest(email, newPassword) {
  const payload = {
    email,
    new_password: newPassword,
  };

  for (const endpoint of AUTH_RESET_DIRECT_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return {
          ok: true,
          message: json?.message || CONNEXION_TEXT.forgotSuccess,
        };
      }

      // 5xx = backend joignable mais erreur serveur (souvent DB indisponible).
      // On tente les autres endpoints puis on offre un fallback.
      if (resp.status >= 500) {
        continue;
      }

      return {
        ok: false,
        message: json?.message || CONNEXION_TEXT.forgotFailure,
      };
    } catch (e) {}
  }

  return {
    ok: false,
    message: CONNEXION_TEXT.forgotFailure,
  };
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ""));
}

function loginLocally({ email, password, nom, prenom }) {
  const users = JSON.parse(localStorage.getItem("users_local") || "[]");
  const found = users.find(
    (u) =>
      String(u.email || "").toLowerCase() ===
        String(email || "").toLowerCase() &&
      String(u.password || "") === String(password || ""),
  );

  if (!found) return false;

  const displayName =
    [found.prenom || prenom || "", found.nom || nom || ""].join(" ").trim() ||
    CONNEXION_TEXT.defaultUser;
  localStorage.setItem("user_nom", displayName);
  localStorage.setItem("user_email", found.email || email || "");
  localStorage.setItem("auth_connected", "1");
  return true;
}
