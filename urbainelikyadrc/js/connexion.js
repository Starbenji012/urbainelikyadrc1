/* CONNEXION.JS - Connexion utilisateur (backend + fallback local) */

const AUTH_LOGIN_ENDPOINTS = [
  "/backend/api/auth/login.php",
  "../backend/api/auth/login.php",
  "backend/api/auth/login.php",
];

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
            alert(result.message || "Identifiants invalides.");
            return;
          }

          // Fallback local uniquement si le backend est vraiment indisponible.
          const localOk = loginLocally({ email, password, nom, prenom });
          if (!localOk) {
            alert("Identifiants invalides.");
            return;
          }
          alert("Connexion locale réussie (backend indisponible). ");
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
          alert("Connexion réussie !");
        }
        window.location.href = "index.html";
      } else {
        alert("Veuillez remplir tous les champs");
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

      return {
        ok: false,
        reachable: true,
        user: null,
        message: json?.message || "Identifiants invalides.",
      };
    } catch (e) {}
  }
  return {
    ok: false,
    reachable: false,
    user: null,
    message: "Backend indisponible.",
  };
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
    "Utilisateur local";
  localStorage.setItem("user_nom", displayName);
  localStorage.setItem("user_email", found.email || email || "");
  localStorage.setItem("auth_connected", "1");
  return true;
}
