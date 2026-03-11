// Liste des idées chargée depuis le backend
let idees = [];

// Fonction pour charger les idées depuis le backend
async function loadIdees() {
  try {
    const response = await fetch("/backend/api/idees.php", {
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error("Erreur HTTP " + response.status);
    }
    idees = await response.json();
  } catch (error) {
    console.error("Erreur réseau:", error);
    idees = [];
  }
}

/* ============================================
   GESTION DU MENU BURGER
   ============================================ */
function initMenuBurger() {
  const menuBurger = document.getElementById("menu-burger");
  const navigationMenu = document.querySelector(".navigation-menu");

  if (menuBurger && navigationMenu) {
    menuBurger.addEventListener("click", () => {
      navigationMenu.classList.toggle("active");
    });

    // Fermer le menu quand un lien est cliqué
    navigationMenu.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        navigationMenu.classList.remove("active");
      });
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Initialiser le menu burger
  initMenuBurger();

  const form = document.getElementById("formIdee");
  const container = document.getElementById("listeIdees");
  const totalEl = document.getElementById("totalIdees");
  const btnVider = document.getElementById("btnViderIdees");

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const titre = (document.getElementById("titre")?.value || "").trim();
      const categorie = (
        document.getElementById("categorie")?.value || ""
      ).trim();
      const description = (
        document.getElementById("description")?.value || ""
      ).trim();
      const photoInput = document.getElementById("photo");

      // Validation basique
      if (!titre || !description) {
        showMessage(
          "Merci de renseigner un titre et une description.",
          "error",
        );
        return;
      }

      // Traiter la photo
      if (photoInput && photoInput.files && photoInput.files[0]) {
        const reader = new FileReader();
        showLoading("Traitement de l'image...");
        reader.onload = async (event) => {
          hideLoading();
          const idee = {
            titre,
            categorie,
            description,
            likes: 0,
            photo: event.target.result,
            timestamp: new Date().toISOString(),
          };
          try {
            const response = await fetch("/backend/api/idees.php", {
              method: "POST",
              credentials: "include",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(idee),
            });
            if (!response.ok) {
              throw new Error("Erreur HTTP " + response.status);
            }
            const data = await response.json();
            if (data.success) {
              await loadIdees();
              renderIdees();
              form.reset();
              showMessage("Idée ajoutée ✅", "success");
            } else {
              throw new Error(data.error || "Erreur lors de l'ajout");
            }
          } catch (error) {
            console.error("Erreur:", error);
            showMessage(
              "Erreur lors de l'ajout de l'idée: " + error.message,
              "error",
            );
          }
        };
        reader.onerror = () => {
          hideLoading();
          showMessage("Erreur lors du chargement de la photo.", "error");
        };
        reader.readAsDataURL(photoInput.files[0]);
      } else {
        const idee = {
          titre,
          categorie,
          description,
          likes: 0,
          photo: null,
          timestamp: new Date().toISOString(),
        };
        try {
          const response = await fetch("/backend/api/idees.php", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(idee),
          });
          if (!response.ok) {
            throw new Error("Erreur HTTP " + response.status);
          }
          const data = await response.json();
          if (data.success) {
            await loadIdees();
            renderIdees();
            form.reset();
            showMessage("Idée ajoutée ✅", "success");
          } else {
            throw new Error(data.error || "Erreur lors de l'ajout");
          }
        } catch (error) {
          console.error("Erreur:", error);
          showMessage(
            "Erreur lors de l'ajout de l'idée: " + error.message,
            "error",
          );
        }
      }
    });
  }

  if (btnVider) {
    btnVider.addEventListener("click", async () => {
      if (!idees.length)
        return showMessage("Il n'y a aucune idée à supprimer.", "error");
      if (confirm("Voulez-vous vraiment supprimer toutes les idées ?")) {
        try {
          const response = await fetch("/backend/api/idees.php", {
            method: "POST",
            credentials: "include",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ action: "clear" }),
          });
          if (!response.ok) {
            throw new Error("Erreur HTTP " + response.status);
          }
          const data = await response.json();
          if (data.success) {
            await loadIdees();
            renderIdees();
            showMessage("Toutes les idées ont été supprimées.", "success");
          } else {
            throw new Error(data.error || "Erreur lors de la suppression");
          }
        } catch (error) {
          console.error("Erreur:", error);
          showMessage(
            "Erreur lors de la suppression: " + error.message,
            "error",
          );
        }
      }
    });
  }

  // affichage initial
  loadIdees().then(() => {
    renderIdees();
  });
});

async function saveAndRender() {
  // Recharger les idées après ajout
  await loadIdees();
  renderIdees();
}

function renderIdees() {
  const container = document.getElementById("listeIdees");
  if (!container) return;

  // Construction efficiente du DOM
  container.innerHTML = "";
  const frag = document.createDocumentFragment();

  idees.forEach((idee, index) => {
    const card = document.createElement("div");
    card.className = "carte-idee";

    // Ajouter la photo si elle existe
    if (idee.photo) {
      const img = document.createElement("img");
      img.src = idee.photo;
      img.alt = idee.titre;
      img.className = "carte-idee-photo";
      card.appendChild(img);
    }

    const h3 = document.createElement("h3");
    h3.textContent = idee.titre;

    const p = document.createElement("p");
    p.textContent = idee.description;

    const span = document.createElement("span");
    span.textContent = idee.categorie;

    // afficher le nombre de likes sans possibilité d'augmenter ici
    const likesDiv = document.createElement("div");
    likesDiv.className = "carte-idee-likes";
    likesDiv.textContent = "❤️ " + (idee.likes || 0);

    const meta = document.createElement("div");
    meta.className = "carte-idee-meta";
    if (idee.timestamp) {
      try {
        const dt = new Date(idee.timestamp).toLocaleString("fr-FR");
        meta.textContent = dt;
      } catch (e) {
        meta.textContent = "Date inconnue";
      }
    }

    // Bouton supprimer pour l'idée
    const btnDelete = document.createElement("button");
    btnDelete.type = "button";
    btnDelete.className = "btn-delete-idee";
    btnDelete.textContent = "Supprimer";
    btnDelete.addEventListener("click", async () => {
      if (!confirm("Supprimer cette idée ?")) return;
      try {
        const response = await fetch("/backend/api/idees.php", {
          method: "DELETE",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: idee.id }),
        });
        if (!response.ok) {
          throw new Error("Erreur HTTP " + response.status);
        }
        const data = await response.json();
        if (data.success) {
          await loadIdees();
          renderIdees();
          showMessage("Idée supprimée.", "success");
        } else {
          throw new Error(data.error || "Erreur lors de la suppression");
        }
      } catch (error) {
        console.error("Erreur:", error);
        showMessage("Erreur lors de la suppression: " + error.message, "error");
      }
    });

    card.appendChild(h3);
    card.appendChild(p);
    card.appendChild(span);
    card.appendChild(likesDiv);
    card.appendChild(meta);
    card.appendChild(btnDelete);

    frag.appendChild(card);
  });

  container.appendChild(frag);
  // Mettre à jour le compteur
  const totalEl = document.getElementById("totalIdees");
  if (totalEl) totalEl.textContent = idees.length;
}

// Affiche un message temporaire (toast). type: 'success' | 'error' | undefined
function showMessage(text, type) {
  const toast = document.createElement("div");
  toast.className = "toast";
  if (type) toast.classList.add(`toast--${type}`);
  toast.textContent = text;
  document.body.appendChild(toast);

  // small delay to allow transition
  requestAnimationFrame(() => toast.classList.add("show"));

  // remove after 3s
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Loading toast helper
let __loadingToastIdees = null;
function showLoading(text = "Chargement...") {
  hideLoading();
  const toast = document.createElement("div");
  toast.className = "toast toast--loading";
  toast.innerHTML =
    '<span class="toast-spinner"></span> ' + (text || "Chargement...");
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  __loadingToastIdees = toast;
}
function hideLoading() {
  if (!__loadingToastIdees) return;
  __loadingToastIdees.classList.remove("show");
  setTimeout(() => {
    if (__loadingToastIdees && __loadingToastIdees.parentNode)
      __loadingToastIdees.parentNode.removeChild(__loadingToastIdees);
    __loadingToastIdees = null;
  }, 220);
}
