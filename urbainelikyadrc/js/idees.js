/* IDEES.JS - backend PHP + fallback localStorage */

let idees = JSON.parse(localStorage.getItem("idees_page") || "[]");

const IDEES_ENDPOINTS = [
  "/backend/api/idees/index.php",
  "../backend/api/idees/index.php",
  "backend/api/idees/index.php",
];

const IDEES_LIKE_ENDPOINTS = [
  "/backend/api/idees/like.php",
  "../backend/api/idees/like.php",
  "backend/api/idees/like.php",
];

const IDEES_DELETE_ENDPOINTS = [
  "/backend/api/idees/delete.php",
  "../backend/api/idees/delete.php",
  "backend/api/idees/delete.php",
];

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
  // Navigation mobile: logique partagee dans utils.js
  initMenuBurger();
  renderIdees();
  loadIdeesFromBackend();

  const form = document.getElementById("formIdee");
  if (form) form.addEventListener("submit", addIdee);

  const btnVider = document.getElementById("btnViderIdees");
  if (btnVider) btnVider.addEventListener("click", clearIdees);
});

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
  // On envoie au backend d'abord; fallback seulement si backend injoignable.
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
        message: json?.message || "Erreur de validation côté backend.",
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
  if (container) {
    container.innerHTML =
      idees
        .map(
          (idee, index) => `
      <div class="carte-idee">
        ${idee.photo ? `<img src="${idee.photo}" alt="Photo idée" class="carte-idee-photo">` : ""}
        <h3>${idee.titre}</h3>
        <p>${idee.description}</p>
        <span class="categorie-badge">${idee.categorie}</span>
        <small>${new Date(idee.timestamp).toLocaleString()}</small>
        <div class="carte-actions">
          <button class="btn-like" onclick="likeIdee(${index})">
            <i class='bx bx-heart'></i> <span class="like-count">${idee.likes}</span>
          </button>
          <button class="btn-delete" onclick="deleteIdee('${idee.id || idee.timestamp}')">Supprimer</button>
        </div>
      </div>
    `,
        )
        .join("") || "<p>Aucune idée.</p>";
  }

  const totalEl = document.getElementById("totalIdees");
  if (totalEl) totalEl.textContent = idees.length;
}

async function likeIdee(index) {
  if (index >= 0 && index < idees.length) {
    const target = idees[index];
    const likedFromBackend =
      target && target.id ? await likeIdeeToBackend(target.id) : false;

    // Même si backend indisponible, on garde l'incrément local pour l'UX.
    idees[index].likes = (idees[index].likes || 0) + 1;
    localStorage.setItem("idees_page", JSON.stringify(idees));
    renderIdees();

    if (!likedFromBackend) {
      console.warn("Like backend indisponible, sauvegarde locale appliquée.");
    }
  }
}

async function deleteIdee(idOrTimestamp) {
  if (confirm("Supprimer ?")) {
    const target = idees.find(
      (i) => String(i.id || i.timestamp) === String(idOrTimestamp),
    );

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
    idees = [];
    localStorage.removeItem("idees_page");
    renderIdees();
  }
}

async function likeIdeeToBackend(id) {
  for (const endpoint of IDEES_LIKE_ENDPOINTS) {
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
