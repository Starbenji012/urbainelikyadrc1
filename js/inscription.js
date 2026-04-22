/* INSCRIPTION.JS - Inscription utilisateur (backend + fallback local) */

const AUTH_REGISTER_ENDPOINTS = buildRegisterEndpoints();

const INSCRIPTION_TEXT = {
  backendRefused: "Inscription refusée par le backend.",
  localRegisterSuccess:
    "Inscription locale réussie (backend indisponible). Vérifiez que le serveur PHP tourne et que l'URL frontend pointe vers lui.",
  registerSuccess: "Inscription réussie !",
  requiredFields: "Veuillez remplir tous les champs",
  backendUnavailable: "Backend indisponible.",
  backendEndpointInvalid:
    "Serveur PHP joignable, mais endpoint API introuvable/invalide. Vérifie la racine du serveur PHP. Détails: ",
  nomLength: "Le nom doit contenir entre 2 et 80 caractères.",
  prenomLength: "Le prénom doit contenir entre 2 et 80 caractères.",
  surnomLength:
    "Le surnom doit contenir entre 2 et 80 caractères (ou rester vide).",
  invalidEmail: "Email invalide.",
  passwordLength: "Le mot de passe doit contenir au moins 8 caractères.",
};

function buildRegisterEndpoints() {
  const endpoints = buildApiEndpoints("auth/register.php");
  const localHosts = ["localhost", "127.0.0.1"];
  const ports = [8000, 8080];

  // Priorité absolue: backend PHP local (évite les 405 du serveur frontend 5500).
  for (const host of localHosts) {
    for (const port of ports) {
      endpoints.push(`http://${host}:${port}/backend/api/auth/register.php`);
      endpoints.push(`http://${host}:${port}/api/auth/register.php`);
    }
  }

  // Fallback additionnel pour certaines structures d'hebergement simplifiées.
  endpoints.push(
    "/api/auth/register.php",
    "../api/auth/register.php",
    "api/auth/register.php",
  );

  return Array.from(new Set(endpoints));
}

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagée dans utils.js.
  initMenuBurger();

  const formInscription = document.getElementById("formIns");
  if (formInscription) {
    formInscription.addEventListener("submit", async (e) => {
      e.preventDefault();
      const nom = document.getElementById("nom").value.trim();
      const prenom = document.getElementById("prenom").value.trim();
      const surnom = document.getElementById("surnom").value.trim();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;

      if (nom && prenom && email && password) {
        const payload = { nom, prenom, surnom, email, password };

        const localError = validateRegisterPayload(payload);
        if (localError) {
          alert(localError);
          return;
        }

        // Tentative backend en priorité.
        const result = await registerToBackend(payload);
        if (!result.ok) {
          if (result.reachable) {
            alert(result.message || INSCRIPTION_TEXT.backendRefused);
            return;
          }

          // Fallback local pour éviter de bloquer l'utilisateur pendant la transition.
          saveLocalUser(payload);
          alert(INSCRIPTION_TEXT.localRegisterSuccess);
        } else {
          alert(INSCRIPTION_TEXT.registerSuccess);
        }

        window.location.href = "connexion.html";
      } else {
        alert(INSCRIPTION_TEXT.requiredFields);
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

async function registerToBackend(payload) {
  let lastReachableMessage = "";
  let seenHttpResponse = false;
  const endpointDiagnostics = [];

  for (const endpoint of AUTH_REGISTER_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });
      seenHttpResponse = true;

      const raw = await resp.text();
      const json = parseApiJson(raw);

      endpointDiagnostics.push(`${endpoint} -> ${resp.status}`);

      if (resp.ok) {
        // Certains endpoints peuvent renvoyer du HTML/warnings PHP avec status 200: on ignore.
        if (!json || typeof json !== "object") {
          const rawPreview = String(raw || "")
            .slice(0, 120)
            .replace(/\s+/g, " ");
          endpointDiagnostics.push(`body: ${rawPreview}`);
          continue;
        }

        // Si l'API renvoie une enveloppe standard, on respecte json.ok meme avec status 200.
        if (Object.prototype.hasOwnProperty.call(json, "ok")) {
          if (json.ok === true) {
            return { ok: true, reachable: true, message: "" };
          }

          let message = json?.message || INSCRIPTION_TEXT.backendRefused;
          if (json?.errors && typeof json.errors === "object") {
            const firstError = Object.values(json.errors).find(
              (value) => typeof value === "string" && value.trim().length > 0,
            );
            if (firstError) message = String(firstError);
          }

          return { ok: false, reachable: true, message: message };
        }

        // JSON sans format API attendu: on tente l'endpoint suivant.
        continue;
      }

      // Si l'endpoint n'existe pas ou ne repond pas en JSON, on tente le suivant.
      if (
        resp.status === 404 ||
        resp.status === 405 ||
        !json ||
        typeof json !== "object"
      ) {
        continue;
      }

      if (json?.errors && typeof json.errors === "object") {
        const firstError = Object.values(json.errors).find(
          (value) => typeof value === "string" && value.trim().length > 0,
        );
        if (firstError) {
          lastReachableMessage = String(firstError);
        }
      }

      if (!lastReachableMessage) {
        lastReachableMessage = json?.message || INSCRIPTION_TEXT.backendRefused;
      }

      return {
        ok: false,
        reachable: true,
        message: lastReachableMessage,
      };
    } catch (e) {
      // On tente l'endpoint suivant.
    }
  }

  if (seenHttpResponse) {
    return {
      ok: false,
      reachable: true,
      message:
        INSCRIPTION_TEXT.backendEndpointInvalid +
        endpointDiagnostics.slice(0, 4).join(" | "),
    };
  }

  return {
    ok: false,
    reachable: false,
    message: lastReachableMessage || INSCRIPTION_TEXT.backendUnavailable,
  };
}

function parseApiJson(raw) {
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (e) {
    // Tolère une sortie PHP polluée (warnings/notices avant/après le JSON).
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = raw.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch (innerError) {
        return null;
      }
    }
    return null;
  }
}

function saveLocalUser(payload) {
  const users = JSON.parse(localStorage.getItem("users_local") || "[]");
  users.push({
    id: `usr_local_${Date.now()}`,
    nom: payload.nom,
    prenom: payload.prenom,
    surnom: payload.surnom || "",
    email: payload.email,
    password: payload.password,
    created_at: new Date().toISOString(),
  });
  localStorage.setItem("users_local", JSON.stringify(users));
}

function validateRegisterPayload(payload) {
  if (payload.nom.length < 2 || payload.nom.length > 80) {
    return INSCRIPTION_TEXT.nomLength;
  }

  if (payload.prenom.length < 2 || payload.prenom.length > 80) {
    return INSCRIPTION_TEXT.prenomLength;
  }

  if (
    payload.surnom &&
    (payload.surnom.length < 2 || payload.surnom.length > 80)
  ) {
    return INSCRIPTION_TEXT.surnomLength;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(payload.email)) {
    return INSCRIPTION_TEXT.invalidEmail;
  }

  if (payload.password.length < 8) {
    return INSCRIPTION_TEXT.passwordLength;
  }

  return "";
}
