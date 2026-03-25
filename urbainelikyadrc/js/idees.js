/* IDEES.JS - Backend PHP avec fallback localStorage */

let idees = JSON.parse(localStorage.getItem("idees_page") || "[]");
let likesCommunaute = JSON.parse(
  localStorage.getItem("idees_communaute_likes") || "{}",
);

const IDEES_ENDPOINTS = [
  "/backend/api/idees/index.php",
  "../backend/api/idees/index.php",
  "backend/api/idees/index.php",
];

const IDEES_DELETE_ENDPOINTS = [
  "/backend/api/idees/delete.php",
  "../backend/api/idees/delete.php",
  "backend/api/idees/delete.php",
];

function resolveCurrentUserName() {
  const candidates = [
    localStorage.getItem("user_nom"),
    localStorage.getItem("username"),
    localStorage.getItem("nom"),
    localStorage.getItem("display_name"),
  ]
    .map((v) => String(v || "").trim())
    .filter(Boolean);

  return candidates[0] || "Utilisateur local";
}

function resolveCurrentUserEmail() {
  return String(localStorage.getItem("user_email") || "")
    .trim()
    .toLowerCase();
}

function readCurrentProfile() {
  const nom = resolveCurrentUserName();
  const email = resolveCurrentUserEmail();
  const connected =
    String(localStorage.getItem("auth_connected") || "") === "1";
  return { connected, nom, email };
}

function isOwnedByCurrentUser(item) {
  const profile = readCurrentProfile();
  if (!profile.connected) return false;

  const itemEmail = String(item?.user_email || "")
    .trim()
    .toLowerCase();
  const itemNom = String(item?.user_nom || "")
    .trim()
    .toLowerCase();
  const profileNom = String(profile.nom || "")
    .trim()
    .toLowerCase();

  if (profile.email && itemEmail) return itemEmail === profile.email;
  return Boolean(profileNom && itemNom && itemNom === profileNom);
}

function getVisibleIdees() {
  return idees.filter((idee) => isOwnedByCurrentUser(idee));
}

function getIdeeLikeCount(idee) {
  // La page Idées affiche la valeur la plus recente entre backend et Communauté.
  const key = String(idee?.id || idee?.timestamp || "");
  const communityLikes = Number(likesCommunaute[key] || 0);
  const persistedLikes = Number(idee?.likes || 0);
  return Math.max(communityLikes, persistedLikes);
}

async function readPhotoAsDataURL(file) {
  if (!file) return "";

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error("La photo dépasse 5MB.");
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Impossible de lire la photo."));
    reader.readAsDataURL(file);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // Navigation mobile: logique partagée dans utils.js.
  initMenuBurger();
  renderIdees();
  loadIdeesFromBackend();

  const form = document.getElementById("formIdee");
  if (form) form.addEventListener("submit", addIdee);

  const btnVider = document.getElementById("btnViderIdees");
  if (btnVider) btnVider.addEventListener("click", clearIdees);

  // Synchronise l'affichage des likes quand la page Communauté en ajoute.
  window.addEventListener("storage", (evt) => {
    if (evt.key === "idees_communaute_likes") {
      likesCommunaute = JSON.parse(
        localStorage.getItem("idees_communaute_likes") || "{}",
      );
      renderIdees();
    }
  });
});

function validateIdeePayload(idee) {
  if (!idee.titre || idee.titre.length < 3 || idee.titre.length > 150) {
    return "Le titre doit contenir entre 3 et 150 caractères.";
  }

  if (
    !idee.description ||
    idee.description.length < 5 ||
    idee.description.length > 2000
  ) {
    return "La description doit contenir entre 5 et 2000 caractères.";
  }

  const allowedCategories = [
    "infrastructure",
    "environnement",
    "services-publics",
    "transport",
    "autre",
  ];

  if (!allowedCategories.includes(String(idee.categorie || "").toLowerCase())) {
    return "Catégorie invalide.";
  }

  return "";
}

function extractBackendErrorMessage(json) {
  if (json?.errors && typeof json.errors === "object") {
    const first = Object.values(json.errors).find(
      (v) => typeof v === "string" && v.trim().length > 0,
    );
    if (first) return String(first);
  }

  if (typeof json?.message === "string" && json.message.trim()) {
    return json.message;
  }

  return "Le backend a refusé la requête.";
}

async function addIdee(e) {
  e.preventDefault();
  const titre = document.getElementById("titre").value.trim();
  const categorie = document.getElementById("categorie").value;
  const desc = document.getElementById("description").value.trim();
  const photoInput = document.getElementById("photo");
  const photoFile =
    photoInput && photoInput.files && photoInput.files[0]
      ? photoInput.files[0]
      : null;

  if (!titre || !desc) {
    alert("Titre et description requis");
    return;
  }

  let photoDataUrl = "";
  try {
    photoDataUrl = await readPhotoAsDataURL(photoFile);
  } catch (error) {
    alert(error.message || "Photo invalide.");
    return;
  }

  const idee = {
    id: `ide_local_${Date.now()}`,
    user_nom: resolveCurrentUserName(),
    user_email: resolveCurrentUserEmail(),
    titre,
    categorie,
    description: desc,
    photo: photoDataUrl,
    likes: 0,
    timestamp: new Date().toISOString(),
  };

  submitIdeeWithFallback(idee, e.target);
}

async function submitIdeeWithFallback(idee, formEl) {
  const localValidationError = validateIdeePayload(idee);
  if (localValidationError) {
    alert(localValidationError);
    return;
  }

  // Envoi backend d'abord; fallback local seulement si backend injoignable.
  const backendCreated = await createIdeeToBackend(idee);
  if (backendCreated.ok) {
    idees.unshift(backendCreated.data);
    localStorage.setItem("idees_page", JSON.stringify(idees));
    renderIdees();
    formEl.reset();
    alert("Idée ajoutée (backend) !");
    return;
  }

  if (backendCreated.reachable) {
    alert(backendCreated.message || "Le backend a refusé la requête.");
    return;
  }

  idees.unshift(idee);
  localStorage.setItem("idees_page", JSON.stringify(idees));
  renderIdees();
  formEl.reset();
  alert("Idée ajoutée en local (backend indisponible) !");
}

async function loadIdeesFromBackend() {
  for (const endpoint of IDEES_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!resp.ok) continue;

      const data = await resp.json();
      if (!Array.isArray(data)) continue;

      // Fusion backend + local sans doublons.
      const byKey = new Map();
      [...data, ...idees].forEach((item) => {
        const k = String(item.id || item.timestamp || item.titre || "");
        if (!byKey.has(k)) byKey.set(k, item);
      });
      idees = Array.from(byKey.values());
      localStorage.setItem("idees_page", JSON.stringify(idees));
      renderIdees();
      return;
    } catch (e) {
      // On essaie un autre endpoint.
    }
  }
}

async function createIdeeToBackend(idee) {
  const payload = {
    titre: idee.titre,
    categorie: idee.categorie,
    description: idee.description,
    user_nom: idee.user_nom || resolveCurrentUserName(),
    user_email: idee.user_email || resolveCurrentUserEmail(),
    photo: idee.photo || "",
  };

  for (const endpoint of IDEES_ENDPOINTS) {
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
        return { ok: true, reachable: true, data: json?.data || idee };
      }

      return {
        ok: false,
        reachable: true,
        data: null,
        message: extractBackendErrorMessage(json),
      };
    } catch (e) {
      // On essaie un autre endpoint.
    }
  }

  return {
    ok: false,
    reachable: false,
    data: null,
    message: "Backend indisponible.",
  };
}

function renderIdees() {
  const container = document.getElementById("listeIdees");
  const profile = readCurrentProfile();
  const visibleIdees = getVisibleIdees();
  const totalEl = document.getElementById("totalIdees");
  if (totalEl) {
    totalEl.textContent = profile.connected ? String(idees.length) : "0";
  }

  if (container) {
    if (!profile.connected) {
      container.innerHTML =
        '<p style="text-align: center; padding: 40px; color: #666; grid-column: 1 / -1;">Connectez-vous pour voir vos idées personnelles.</p>';
      return;
    }

    container.innerHTML =
      visibleIdees
        .map(
          (idee) => `
      <div class="carte-idee ${idee.photo ? "" : "no-photo"}">
        ${idee.photo ? `<img src="${idee.photo}" alt="Photo idée" class="carte-idee-photo">` : ""}
        <h3>${idee.titre}</h3>
        <p>${idee.description}</p>
        ${idee.user_nom ? `<p class="carte-idee-author">Par : ${idee.user_nom}</p>` : ""}
        <span class="categorie-badge">${idee.categorie}</span>
        <small>${new Date(idee.timestamp).toLocaleString()}</small>
        <div class="carte-actions">
          <button class="btn-like" type="button" disabled title="Le like se fait dans la page Communauté">
            <i class='bx bx-heart'></i> <span class="like-count">${getIdeeLikeCount(idee)}</span>
          </button>
          <button class="btn-delete-idee" onclick="deleteIdee('${idee.id || idee.timestamp}')">Supprimer</button>
        </div>
      </div>
    `,
        )
        .join("") || "<p>Aucune idée pour votre compte.</p>";
  }

  // totalIdees reste global (tous utilisateurs), deja mis a jour en debut de fonction.
}

async function deleteIdee(idOrTimestamp) {
  if (confirm("Supprimer ?")) {
    const target = idees.find(
      (i) => String(i.id || i.timestamp) === String(idOrTimestamp),
    );

    if (!target || !isOwnedByCurrentUser(target)) {
      alert("Vous ne pouvez supprimer que vos propres idées.");
      return;
    }

    if (target && target.id) {
      await deleteIdeeToBackend(target.id);
    }

    idees = idees.filter(
      (i) => String(i.id || i.timestamp) !== String(idOrTimestamp),
    );
    localStorage.setItem("idees_page", JSON.stringify(idees));
    renderIdees();
  }
}

function clearIdees() {
  if (confirm("Vider toutes les idées ?")) {
    idees = idees.filter((idee) => !isOwnedByCurrentUser(idee));
    localStorage.setItem("idees_page", JSON.stringify(idees));
    renderIdees();
  }
}

async function deleteIdeeToBackend(id) {
  for (const endpoint of IDEES_DELETE_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ id }),
      });
      if (resp.ok) return true;
    } catch (e) {
      // On essaie l'endpoint suivant.
    }
  }
  return false;
}
