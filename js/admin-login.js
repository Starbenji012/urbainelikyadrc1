const ADMIN_LOGIN_ENDPOINTS = buildApiEndpoints("auth/login.php");

const ADMIN_LOGIN_TEXT = {
  requiredFields: "Veuillez renseigner email et mot de passe.",
  invalidCredentials: "Identifiants invalides.",
  forbiddenRole: "Ce compte n'a pas le rôle administrateur.",
  backendUnavailable: "Backend indisponible.",
  loginSuccess: "Connexion administrateur réussie.",
};

document.addEventListener("DOMContentLoaded", () => {
  initMenuBurger();

  const loginBtn = document.getElementById("adminLoginBtn");
  if (loginBtn) {
    loginBtn.addEventListener("click", handleAdminLogin);
  }

  const passwordInput = document.getElementById("adminPassword");
  if (passwordInput) {
    passwordInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleAdminLogin();
      }
    });
  }
});

async function handleAdminLogin() {
  const email = String(
    document.getElementById("adminEmail")?.value || "",
  ).trim();
  const password = String(
    document.getElementById("adminPassword")?.value || "",
  );

  if (!email || !password) {
    alert(ADMIN_LOGIN_TEXT.requiredFields);
    return;
  }

  const response = await loginAdminToBackend({ email, password });
  if (!response.ok) {
    alert(response.message || ADMIN_LOGIN_TEXT.invalidCredentials);
    return;
  }

  const user = response.user || {};
  const role = String(user.role || "").toLowerCase();
  if (!["admin", "super_admin"].includes(role)) {
    clearAdminSession();
    alert(ADMIN_LOGIN_TEXT.forbiddenRole);
    return;
  }

  const displayName =
    [user.prenom, user.nom, user.surnom].filter(Boolean).join(" ").trim() ||
    email;

  window.__adminAuthProfile = {
    id: String(user.id || user.id_utilisateur || ""),
    nom: displayName,
    email: String(user.email || email),
    role,
  };

  localStorage.setItem("admin_auth_token", String(user.auth_token || ""));
  localStorage.setItem("admin_auth_connected", "1");
  localStorage.setItem("admin_user_role", role);
  localStorage.setItem("admin_user_email", String(user.email || email));
  localStorage.setItem("admin_user_name", displayName);
  localStorage.setItem(
    "admin_user_id",
    String(user.id || user.id_utilisateur || ""),
  );

  alert(ADMIN_LOGIN_TEXT.loginSuccess);
  window.location.href = "dashboard.html";
}

async function loginAdminToBackend(payload) {
  for (const endpoint of ADMIN_LOGIN_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (resp.status >= 500) {
          continue;
        }
        return {
          ok: false,
          message: json?.message || ADMIN_LOGIN_TEXT.invalidCredentials,
        };
      }

      return {
        ok: true,
        user: json?.data || null,
      };
    } catch (error) {
      continue;
    }
  }

  return {
    ok: false,
    message: ADMIN_LOGIN_TEXT.backendUnavailable,
  };
}

function clearAdminSession() {
  localStorage.removeItem("admin_auth_token");
  localStorage.removeItem("admin_auth_connected");
  localStorage.removeItem("admin_user_role");
  localStorage.removeItem("admin_user_email");
  localStorage.removeItem("admin_user_name");
  localStorage.removeItem("admin_user_id");
  window.__adminAuthProfile = null;
}
